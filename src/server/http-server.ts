import { timingSafeEqual } from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import * as fs from 'fs';
import * as k8s from '@kubernetes/client-node';
import { z } from 'zod';
import { getAgentRunnable, AgentState, SUPPORTED_ZONES, ZONE_KUBECONFIG_MAP } from './agent/graph';

const app = express();
const PORT = process.env.PORT || 3000;
const INSPECTOR_API_KEY_HEADER = 'x-tentix-inspector-key';
const DEFAULT_JSON_BODY_LIMIT = '256kb';
const JSON_BODY_LIMIT = getJsonBodyLimit();
const jsonBodyParser = express.json({ limit: JSON_BODY_LIMIT });

const SkillsPayloadSchema = z
  .object({
    zone: z.string().optional(),
    namespace: z.string().optional(),
    ticketTitle: z.string().optional(),
    ticketModule: z.string().optional(),
    ticketCategory: z.string().optional(),
    ticketDescription: z.string().optional(),
    historyMessages: z.string().optional(),
    latestMessage: z.string().optional(),
    latestMessageImages: z.array(z.string()).optional(),
  })
  .passthrough();

function pickQueryString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function decodeRequestKubeconfig(authHeader: string): string {
  const encoded = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : authHeader;

  return decodeURIComponent(encoded).trim();
}

function isValidKubeconfig(kubeconfig: string): boolean {
  try {
    const kubeConfig = new k8s.KubeConfig();
    kubeConfig.loadFromString(kubeconfig);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getJsonBodyLimit(): string {
  const limit = (process.env.JSON_BODY_LIMIT ?? DEFAULT_JSON_BODY_LIMIT).trim();

  if (/^[1-9]\d*(?:b|kb|mb)$/i.test(limit)) {
    return limit;
  }

  console.error(`[HTTP] invalid JSON_BODY_LIMIT="${limit}", fallback to ${DEFAULT_JSON_BODY_LIMIT}`);
  return DEFAULT_JSON_BODY_LIMIT;
}

function safeEqualSecret(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function getConfiguredInspectorApiKey(): string {
  return (process.env.TENTIX_INSPECTOR_API_KEY ?? '').trim();
}

function logInspectorAuthFailure(req: Request, reason: string): void {
  console.error('[HTTP] /api/skills auth failed:', {
    reason,
    ip: req.ip,
    zone: pickQueryString(req.query.zone) ?? '',
    namespace: pickQueryString(req.query.namespace) ?? '',
    userAgent: req.header('user-agent') ?? '',
  });
}

function authenticateInspectorRequest(req: Request, res: Response, next: NextFunction): void {
  const expectedApiKey = getConfiguredInspectorApiKey();

  if (!expectedApiKey) {
    logInspectorAuthFailure(req, 'server_auth_not_configured');
    res.status(500).json({ error: 'server auth is not configured' });
    return;
  }

  const actualApiKey = (req.header(INSPECTOR_API_KEY_HEADER) ?? '').trim();

  if (!actualApiKey || !safeEqualSecret(actualApiKey, expectedApiKey)) {
    logInspectorAuthFailure(req, actualApiKey ? 'invalid_api_key' : 'missing_api_key');
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  next();
}

const SUPPORTED_ZONE_SET = new Set(SUPPORTED_ZONES);

function extractErrorText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (!isRecord(value)) {
    return '';
  }

  const parts: string[] = [];

  if (typeof value.code === 'string') {
    parts.push(value.code);
  }
  if (typeof value.message === 'string') {
    parts.push(value.message);
  }

  return parts.join(' ').trim();
}

function looksLikeTimeout(value: unknown): boolean {
  return /timed?\s*out|timeout|ETIMEDOUT|ESOCKETTIMEDOUT|AbortError/i.test(
    extractErrorText(value)
  );
}

function getSkillsResponseStatus(finalResult: unknown): number {
  if (finalResult == null) {
    return 502;
  }

  if (!isRecord(finalResult)) {
    return 200;
  }

  const result = finalResult.result;

  if (isRecord(result) && result.success === false) {
    return looksLikeTimeout(result.error) ? 504 : 502;
  }

  return 200;
}

function handleJsonParseError(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  void req;

  if (isRecord(error) && error.type === 'entity.too.large') {
    res.status(413).json({ error: 'request body too large' });
    return;
  }

  if (error instanceof SyntaxError) {
    res.status(400).json({ error: 'invalid json body' });
    return;
  }

  next(error);
}

app.post('/api/skills', authenticateInspectorRequest, jsonBodyParser, async (req: Request, res: Response) => {
  try {
    const body = SkillsPayloadSchema.parse(req.body ?? {});
    let requestKubeconfig: string | undefined;
    const authHeader = req.header('authorization');

    if (authHeader) {
      try {
        requestKubeconfig = decodeRequestKubeconfig(authHeader);
      } catch {
        return res
          .status(400)
          .json({ error: 'invalid Authorization header kubeconfig encoding' });
      }

      if (!requestKubeconfig || !isValidKubeconfig(requestKubeconfig)) {
        return res.status(400).json({ error: 'invalid kubeconfig content in Authorization header' });
      }
    }

    // zone/namespace 只认 URL query；body 里同名字段一律忽略
    const zone = (pickQueryString(req.query.zone) ?? '').trim();
    const namespace = (pickQueryString(req.query.namespace) ?? '').trim();

    if (!zone) {
      return res.status(400).json({ error: 'zone is required' });
    }
    if (!namespace) {
      return res.status(400).json({ error: 'namespace is required' });
    }
    if (!SUPPORTED_ZONE_SET.has(zone)) {
      return res.status(400).json({
        error: `unsupported zone: ${zone}. supported zones: ${SUPPORTED_ZONES.join(', ')}`,
      });
    }

    const localKubeconfigPath = ZONE_KUBECONFIG_MAP[zone];

    if (!requestKubeconfig && !fs.existsSync(localKubeconfigPath)) {
      return res.status(404).json({
        error: `kubeconfig not found for zone: ${zone}; provide Authorization header kubeconfig or configure local kubeconfig file`,
      });
    }

    const initialState: AgentState = {
      zone,
      namespace,
      ticketTitle: body.ticketTitle ?? '',
      ticketModule: body.ticketModule ?? '',
      ticketCategory: body.ticketCategory ?? '',
      ticketDescription: body.ticketDescription ?? '',
      historyMessages: body.historyMessages ?? '',
      latestMessage: body.latestMessage ?? '',
      latestMessageImages: body.latestMessageImages ?? [],
      requestKubeconfig,
    };

    console.error(`[HTTP] /api/skills zone=${zone} namespace=${namespace}`);

    const runnable = await getAgentRunnable();
    const finalState = await runnable.invoke(initialState);
    const finalResult = finalState.finalResult ?? null;

    if (isRecord(finalResult) && finalResult.tool === 'none') {
      return res.status(204).end();
    }

    const status = getSkillsResponseStatus(finalResult);

    res.status(status).json(finalResult);
  } catch (error) {
    console.error('[HTTP] /api/skills error:', error);
    const status = looksLikeTimeout(error) ? 504 : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : 'Internal Server Error' });
  }
});

app.use(handleJsonParseError);

async function startServer() {
  console.error('[HTTP Server] Initializing /api/skills only...');
  app.listen(PORT, () => {
    console.error(`[HTTP Server] Server is running on http://localhost:${PORT}`);
    console.error(`[HTTP Server] POST http://localhost:${PORT}/api/skills`);
  });
}

startServer().catch((error) => {
  console.error('[HTTP Server] Fatal error:', error);
  process.exit(1);
});
