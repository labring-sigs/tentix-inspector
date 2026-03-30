import * as dotenv from "dotenv";
dotenv.config(); // 1. 加载 .env

import * as path from 'path';
import { KubernetesClient } from '../kubernetes/client';
import { ChatOpenAI } from "@langchain/openai"; // 2. 引入 OpenAI 适配器

// 导入工具定义和函数
import {
  LIST_PODS_BY_NS_TOOL,
  LIST_DEVBOX_BY_NS_TOOL,
  LIST_CLUSTER_BY_NS_TOOL,
  LIST_QUOTA_BY_NS_TOOL,
  LIST_INGRESS_BY_NS_TOOL,
  LIST_CRONJOBS_BY_NS_TOOL,
  LIST_EVENTS_BY_NS_TOOL,
  LIST_DEBT_BY_NS_TOOL,
  LIST_OBJECTSTORAGEBUCKET_BY_NS_TOOL,
  LIST_CERTIFICATE_BY_NS_TOOL,
  LIST_DEPLOYMENTS_BY_NS_TOOL,
  NONE_TOOL,
} from '../tools/types';

import { listPodsByNamespace } from '../tools/list-pods-by-ns';
import { listDevboxByNamespace } from '../tools/list-devbox-by-ns';
import { listClusterByNamespace } from '../tools/list-cluster-by-ns';
import { listQuotaByNamespace } from '../tools/list-quota-by-ns';
import { listIngressByNamespace } from '../tools/list-ingress-by-ns';
import { listCronjobsByNamespace } from '../tools/list-cronjobs-by-ns';
import { listEventsByNamespace } from '../tools/list-events-by-ns';
import { listDebtByNamespace } from '../tools/list-debt-by-ns';
import { listObjectStorageBucketByNamespace } from '../tools/list-objectstoragebucket-by-ns';
import { listCertificateByNamespace } from '../tools/list-certificate-by-ns';
import { listDeploymentsByNamespace } from '../tools/list-deployments-by-ns';
import { returnNoneResult } from '../tools/none-tool';

// --- A. 初始化 AI 模型 (Gemini) ---
const AI_API_KEY = process.env.AI_API_KEY;
const AI_BASE_URL = process.env.AI_BASE_URL;
const AI_MODEL = process.env.AI_MODEL || "gemini-1.5-flash";
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 15_000);

// >>>>>> 新增这几行调试代码 >>>>>>
console.log("--------------------------------------------------");
console.log("[DEBUG] Current CWD:", process.cwd());
console.log("[DEBUG] AI_MODEL:", AI_MODEL);
console.log("[DEBUG] AI_API_KEY Type:", typeof AI_API_KEY);
console.log("[DEBUG] AI_API_KEY Length:", AI_API_KEY ? AI_API_KEY.length : "Missing/Undefined");
console.log("--------------------------------------------------");
// <<<<<< 结束新增 <<<<<<


// 检查配置
if (!AI_API_KEY || !AI_BASE_URL) {
  // 如果没配置，我们在 Router 里会做降级处理，或者在这里抛出错误
  console.warn("[Agent] Warning: AI_API_KEY or AI_BASE_URL not set in .env");
}

const formattedBaseUrl = AI_BASE_URL?.endsWith("/v1") ? AI_BASE_URL : `${AI_BASE_URL}/v1`;

const llm = new ChatOpenAI({
  modelName: AI_MODEL,
  apiKey: AI_API_KEY,
  configuration: { baseURL: formattedBaseUrl },
  timeout: LLM_TIMEOUT_MS,
  temperature: 0,
});

// --- B. 定义 State ---
export interface AgentState {
  zone: string;
  namespace: string;
  ticketTitle: string;
  ticketModule: string;
  ticketDescription: string;
  historyMessages: string;
  latestMessage: string;
  latestMessageImages: string[];

  k8sClient?: KubernetesClient;
  selectedTool?: ToolName;
  toolInput?: unknown;

  finalResult?: unknown;
}

export type AgentRunnable = {
  invoke: (input: AgentState) => Promise<AgentState>;
};

// Zone 映射
const ZONE_KUBECONFIG_MAP: Record<string, string> = {
  hzh: path.join(process.cwd(), 'kubeconfig', 'hzh-kubeconfig'),
  bja: path.join(process.cwd(), 'kubeconfig', 'bja-kubeconfig'),
  gzg: path.join(process.cwd(), 'kubeconfig', 'gzg-kubeconfig'),
  default: path.join(process.cwd(), 'kubeconfig', 'Mykubeconfig'),
};

// 工具注册表
const TOOLS = {
  [LIST_PODS_BY_NS_TOOL.name]: {
    description: LIST_PODS_BY_NS_TOOL.description,
    run: (client: KubernetesClient, input: unknown) => listPodsByNamespace(client, input as any),
  },
  [LIST_DEVBOX_BY_NS_TOOL.name]: {
    description: LIST_DEVBOX_BY_NS_TOOL.description,
    run: (client: KubernetesClient, input: unknown) => listDevboxByNamespace(client, input as any),
  },
  [LIST_CLUSTER_BY_NS_TOOL.name]: {
    description: LIST_CLUSTER_BY_NS_TOOL.description,
    run: (client: KubernetesClient, input: unknown) => listClusterByNamespace(client, input as any),
  },
  [LIST_QUOTA_BY_NS_TOOL.name]: {
    description: LIST_QUOTA_BY_NS_TOOL.description,
    run: (client: KubernetesClient, input: unknown) => listQuotaByNamespace(client, input as any),
  },
  [LIST_INGRESS_BY_NS_TOOL.name]: {
    description: LIST_INGRESS_BY_NS_TOOL.description,
    run: (client: KubernetesClient, input: unknown) => listIngressByNamespace(client, input as any),
  },
  [LIST_CRONJOBS_BY_NS_TOOL.name]: {
    description: LIST_CRONJOBS_BY_NS_TOOL.description,
    run: (client: KubernetesClient, input: unknown) => listCronjobsByNamespace(client, input as any),
  },
  [LIST_EVENTS_BY_NS_TOOL.name]: {
    description: LIST_EVENTS_BY_NS_TOOL.description,
    run: (client: KubernetesClient, input: unknown) => listEventsByNamespace(client, input as any),
  },
  [LIST_DEBT_BY_NS_TOOL.name]: {
    description: LIST_DEBT_BY_NS_TOOL.description,
    run: (client: KubernetesClient, input: unknown) => listDebtByNamespace(client, input as any),
  },
  [LIST_OBJECTSTORAGEBUCKET_BY_NS_TOOL.name]: {
    description: LIST_OBJECTSTORAGEBUCKET_BY_NS_TOOL.description,
    run: (client: KubernetesClient, input: unknown) =>
      listObjectStorageBucketByNamespace(client, input as any),
  },
  [LIST_CERTIFICATE_BY_NS_TOOL.name]: {
    description: LIST_CERTIFICATE_BY_NS_TOOL.description,
    run: (client: KubernetesClient, input: unknown) =>
      listCertificateByNamespace(client, input as any),
  },
  [LIST_DEPLOYMENTS_BY_NS_TOOL.name]: {
    description: LIST_DEPLOYMENTS_BY_NS_TOOL.description,
    run: (client: KubernetesClient, input: unknown) =>
      listDeploymentsByNamespace(client, input as any),
  },
  [NONE_TOOL.name]: {
    description: NONE_TOOL.description,
    run: (client: KubernetesClient, input: unknown) => {
      void client;
      void input;
      return returnNoneResult();
    },
  },
} as const;

type ToolName = keyof typeof TOOLS;

// 自动生成 AI Prompt (无需手动维护两份列表)
const GENERATED_TOOLS_DESC = Object.entries(TOOLS)
  .map(([name, tool], index) => `${index + 1}. ${name}: ${tool.description}`)
  .join('\n');

const SYSTEM_PROMPT = `
You are a Kubernetes Expert Agent.
Your job is to select the BEST tool based on the user's ticket description.

Available Tools:
${GENERATED_TOOLS_DESC}

Tool Selection Rules:
- Prioritize Latest Message when deciding whether the current user reply needs a cluster query right now.
- If the current user reply is only a greeting, acknowledgement, thanks, filler, or otherwise does not require any Kubernetes/cluster/namespace resource query, select "none".
- If the user is clearly asking to inspect, list, check, or troubleshoot cluster resources, do not select "none".

Output Format:
You MUST return a strictly valid JSON object. No markdown.
Structure:
{
  "selectedTool": "tool_name_from_above",
  "toolInput": {
    "namespace": "extracted_namespace_from_context_or_default"
  }
}
Note: If the tool is 'none', 'toolInput' should be empty object {}.
`;

// --- Node 1: Init ---
async function initContextNode(state: AgentState): Promise<Partial<AgentState>> {
  const selectedZone = (state.zone || '').trim();
  const kubeconfigPath = ZONE_KUBECONFIG_MAP[selectedZone];

  if (!kubeconfigPath) {
    throw new Error(`[Agent] Unsupported zone: ${selectedZone}`);
  }

  const namespace = (state.namespace || '').trim();
  if (!namespace.startsWith('ns-') || namespace.length <= 3) {
    throw new Error('[Agent] Invalid namespace format, expected ns-xxx');
  }

  const userName = namespace.slice(3); // ns-xxx -> xxx

  // 1) master client: use zone kubeconfig to query User CRD
  console.log(`[Agent] Init master KubernetesClient for zone=${selectedZone}`);
  const masterClient = new KubernetesClient(kubeconfigPath);

  // 2) fetch user kubeconfig from cluster-scoped CRD: users.user.sealos.io (user.sealos.io/v1)
  const customObjectsApi = masterClient.getCustomObjectsApi();
  const userObjResp = await customObjectsApi.getClusterCustomObject(
    'user.sealos.io',
    'v1',
    'users',
    userName
  );
  const userObj = userObjResp.body as any;
  const userKubeconfig: string | undefined = userObj?.status?.kubeConfig;

  if (!userKubeconfig || typeof userKubeconfig !== 'string' || userKubeconfig.trim() === '') {
    throw new Error('[Agent] Failed to get user kubeconfig from User.status.kubeConfig');
  }

  // 允许日志出现 kubeconfig（按你的要求），但建议至少加一个明显的前缀便于 grep/审计
  console.error(`[Agent] User kubeconfig fetched for user=${userName} zone=${selectedZone}`);
  console.error(`[Agent] User kubeconfig content:\n${userKubeconfig}`);

  // 3) user client: all subsequent tools will use this client (user cluster only)
  const userClient = new KubernetesClient(undefined, userKubeconfig);
  return { k8sClient: userClient };
}

// --- Node 2: Router (AI 智能版) ---
async function routerNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log(`[Router] Asking AI (${AI_MODEL}) to select tool...`);

  const userContext = `
    User Context:
    - Default Namespace: ${state.namespace}
    - Ticket Title: ${state.ticketTitle}
    - Ticket Description: ${state.ticketDescription}
    - Latest Message: ${state.latestMessage}
  `;

  try {
    // 调用 Gemini
    const response = await llm.invoke([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContext }
    ]);

    const content = response.content as string;
    console.log("[Router] AI raw response:", content);

    // 清理 JSON 格式 (Gemini 喜欢加 \`\`\`json)
    const cleanedContent = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const decision = JSON.parse(cleanedContent);
    const selectedTool = typeof decision.selectedTool === 'string' ? decision.selectedTool : '';

    if (!Object.prototype.hasOwnProperty.call(TOOLS, selectedTool)) {
      throw new Error(`[Router] AI selected unsupported tool: ${selectedTool}`);
    }

    return {
      selectedTool: selectedTool as ToolName,
      toolInput: decision.toolInput || {}
    };

  } catch (error) {
    console.error("[Router] AI parsing failed, falling back to list_pods", error);
    // 兜底逻辑
    return { 
      selectedTool: 'list_pods_by_ns', 
      toolInput: { namespace: state.namespace } 
    };
  }
}

// --- Node 3: Executor ---
async function executorNode(state: AgentState): Promise<Partial<AgentState>> {
  if (!state.k8sClient) {
    throw new Error('[Agent] k8sClient not initialized');
  }

  const selectedTool: ToolName = (state.selectedTool ?? 'list_pods_by_ns') as ToolName;
  const tool = TOOLS[selectedTool];

  if (!tool) {
    throw new Error(`[Agent] Unknown tool: ${String(state.selectedTool)}`);
  }

  // 不信任 LLM/toolInput 里的 namespace；最终执行强制使用 state.namespace
  const rawToolInput = state.toolInput;
  const toolInputObject =
    rawToolInput && typeof rawToolInput === 'object' && !Array.isArray(rawToolInput)
      ? (rawToolInput as Record<string, unknown>)
      : {};
  const input: unknown =
    selectedTool === 'none'
      ? {}
      : { ...toolInputObject, namespace: state.namespace };

  const result = await tool.run(state.k8sClient, input);

  return {
    finalResult: {
      tool: selectedTool,
      description: tool.description,
      result,
    },
  };
}

// --- 构建图 (保留动态导入以防编译错误) ---
let cachedRunnable: AgentRunnable | null = null;

export async function getAgentRunnable(): Promise<AgentRunnable> {
  if (cachedRunnable) return cachedRunnable;

  const langgraph = (await import('@langchain/langgraph')) as any;
  const START = langgraph.START;
  const END = langgraph.END;
  const StateGraph = langgraph.StateGraph;
  const Annotation = langgraph.Annotation;

  const GraphState = Annotation.Root({
    zone: Annotation(),
    namespace: Annotation(),
    ticketTitle: Annotation(),
    ticketModule: Annotation(),
    ticketDescription: Annotation(),
    historyMessages: Annotation(),
    latestMessage: Annotation(),
    latestMessageImages: Annotation(),

    k8sClient: Annotation(),
    selectedTool: Annotation(),
    toolInput: Annotation(),
    finalResult: Annotation(),
  });

  const workflow = new StateGraph(GraphState)
    .addNode('init', initContextNode)
    .addNode('router', routerNode)
    .addNode('executor', executorNode)
    .addEdge(START, 'init')
    .addEdge('init', 'router')
    .addEdge('router', 'executor')
    .addEdge('executor', END);

  cachedRunnable = workflow.compile() as AgentRunnable;
  return cachedRunnable;
}
