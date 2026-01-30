import express, { Request, Response } from 'express';
import { z } from 'zod';
import { getAgentRunnable, AgentState } from './agent/graph';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const SkillsPayloadSchema = z
  .object({
    zone: z.string().optional(),
    namespace: z.string().optional(),
    ticketTitle: z.string().optional(),
    ticketModule: z.string().optional(),
    ticketDescription: z.string().optional(),
    historyMessages: z.string().optional(),
    latestMessage: z.string().optional(),
    latestMessageImages: z.array(z.string()).optional(),
  })
  .passthrough();

function pickQueryString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

app.post('/api/skills', async (req: Request, res: Response) => {
  try {
    const body = SkillsPayloadSchema.parse(req.body ?? {});
    const zoneFromQuery = pickQueryString(req.query.zone);
    const namespaceFromQuery = pickQueryString(req.query.namespace);

    const zone = (body.zone ?? zoneFromQuery ?? 'default').trim();
    const namespace = (body.namespace ?? namespaceFromQuery ?? '').trim();

    if (!zone) {
      return res.status(400).json({ error: 'zone is required' });
    }
    if (!namespace) {
      return res.status(400).json({ error: 'namespace is required' });
    }

    const initialState: AgentState = {
      zone,
      namespace,
      ticketTitle: body.ticketTitle ?? '',
      ticketModule: body.ticketModule ?? '',
      ticketDescription: body.ticketDescription ?? '',
      historyMessages: body.historyMessages ?? '',
      latestMessage: body.latestMessage ?? '',
      latestMessageImages: body.latestMessageImages ?? [],
    };

    console.error(`[HTTP] /api/skills zone=${zone} namespace=${namespace}`);

    const runnable = await getAgentRunnable();
    const finalState = await runnable.invoke(initialState);

    res.json(finalState.finalResult ?? null);
  } catch (error) {
    console.error('[HTTP] /api/skills error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal Server Error' });
  }
});

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
