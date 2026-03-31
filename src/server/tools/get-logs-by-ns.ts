import { GetLogsByNsInput, GetLogsByNsInputSchema } from './types';
import { KubernetesClient } from '../kubernetes/client';
import {
  GetLogsResponse,
  KubernetesError,
  LogPodCandidate,
} from '../kubernetes/types';
import * as k8s from '@kubernetes/client-node';

type ModuleHint = 'applaunchpad' | 'db' | 'devbox' | 'unknown';

interface LogsExecutionInput extends GetLogsByNsInput {
  ticketModule?: string;
  ticketTitle?: string;
  ticketDescription?: string;
  historyMessages?: string;
  latestMessage?: string;
}

interface ScoredPodCandidate extends LogPodCandidate {
  rawPod: k8s.V1Pod;
  textScore: number;
  healthScore: number;
}

type PodResolution =
  | { type: 'resolved'; candidate: ScoredPodCandidate }
  | { type: 'ambiguous_pod'; message: string; candidates: LogPodCandidate[] };

type ContainerResolution =
  | { type: 'resolved'; containerName: string }
  | { type: 'ambiguous_container'; message: string; containerCandidates: string[] };

const APP_LABEL = 'app';
const APP_DEPLOY_MANAGER_LABEL = 'cloud.sealos.io/app-deploy-manager';
const DB_INSTANCE_LABEL = 'app.kubernetes.io/instance';
const DB_BACKUP_LABEL = 'dataprotection.kubeblocks.io/backup-name';
const DEVBOX_NAME_LABEL = 'app.kubernetes.io/name';
const DEVBOX_PART_OF_LABEL = 'app.kubernetes.io/part-of';
const MAX_LOG_LINES = 200;

const KNOWN_SIDECARS = new Set([
  'lorry',
  'config-manager',
  'istio-proxy',
  'linkerd-proxy',
  'envoy',
  'mysql-exporter',
  'postgres-exporter',
  'redis-exporter',
  'metrics',
  'metrics-server',
]);

const DB_MAIN_CONTAINER_PRIORITY = [
  'postgresql',
  'mongodb',
  'mysql',
  'redis',
  'kafka',
  'kafka-server',
  'kafka-broker',
  'qdrant',
  'nebula',
  'nebula-graphd',
  'weaviate',
  'milvus',
  'pulsar',
  'bookies',
  'clickhouse',
];

function extractKubernetesError(error: any): KubernetesError {
  if (error && error.response && error.body) {
    const statusCode = error.statusCode || (error.response && error.response.statusCode);

    let k8sError: KubernetesError = {
      code: statusCode,
      message: 'Unknown Kubernetes error',
    };

    try {
      if (typeof error.body === 'string') {
        const errorBody = JSON.parse(error.body);
        k8sError = {
          code: errorBody.code || statusCode,
          reason: errorBody.reason,
          message: errorBody.message || error.body,
          details: errorBody.details,
        };
      } else if (typeof error.body === 'object') {
        k8sError = {
          code: error.body.code || statusCode,
          reason: error.body.reason,
          message: error.body.message || JSON.stringify(error.body),
          details: error.body.details,
        };
      }
    } catch {
      k8sError.message = error.message || 'Failed to parse Kubernetes error';
    }

    return k8sError;
  }

  return {
    message: error instanceof Error ? error.message : 'Unknown error occurred',
  };
}

function calculateAge(creationTimestamp: Date): string {
  const now = new Date();
  const diff = now.getTime() - creationTimestamp.getTime();

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return hours > 0 ? `${days}d${hours}h` : `${days}d`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[\s_\-./:]+/g, '');
}

function matchesQuery(queryText: string, value: string): boolean {
  if (!queryText || !value) {
    return false;
  }

  const rawQuery = queryText.toLowerCase();
  const rawValue = value.toLowerCase();

  if (rawQuery.includes(rawValue)) {
    return true;
  }

  const normalizedQuery = normalizeForMatch(queryText);
  const normalizedValue = normalizeForMatch(value);

  return normalizedValue.length >= 4 && normalizedQuery.includes(normalizedValue);
}

function buildQueryText(input: Partial<LogsExecutionInput>): string {
  return [
    input.latestMessage,
    input.ticketTitle,
    input.ticketDescription,
    input.historyMessages,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .join('\n');
}

function buildPrimaryQuery(input: Partial<LogsExecutionInput>): string {
  return (
    [input.latestMessage, input.ticketTitle, input.ticketDescription].find(
      (value): value is string => typeof value === 'string' && value.trim() !== ''
    ) || ''
  );
}

function normalizeModuleHint(ticketModule: string | undefined, queryText: string): ModuleHint {
  const normalized = (ticketModule || '').trim().toLowerCase();

  if (normalized === 'applaunchpad' || normalized === 'app launchpad' || normalized === '应用管理') {
    return 'applaunchpad';
  }

  if (normalized === 'db' || normalized === 'database' || normalized === '数据库') {
    return 'db';
  }

  if (normalized === 'devbox') {
    return 'devbox';
  }

  const query = queryText.toLowerCase();

  if (query.includes('devbox') || query.includes('cursor') || query.includes('ssh')) {
    return 'devbox';
  }

  if (
    query.includes('数据库') ||
    query.includes('mysql') ||
    query.includes('postgres') ||
    query.includes('redis') ||
    query.includes('mongodb')
  ) {
    return 'db';
  }

  if (
    query.includes('应用管理') ||
    query.includes('公网') ||
    query.includes('域名') ||
    query.includes('镜像')
  ) {
    return 'applaunchpad';
  }

  return 'unknown';
}

function stripReplicaSetHash(value: string): string {
  return value.replace(/-[a-f0-9]{9,10}$/i, '');
}

function getPodContainers(pod: k8s.V1Pod): string[] {
  return (pod.spec?.containers ?? [])
    .map((container) => container.name)
    .filter((name): name is string => Boolean(name));
}

function getPodRestarts(pod: k8s.V1Pod): number {
  return (pod.status?.containerStatuses ?? []).reduce(
    (sum, containerStatus) => sum + (containerStatus.restartCount ?? 0),
    0
  );
}

function getPodReady(pod: k8s.V1Pod): string {
  const total = pod.spec?.containers?.length ?? 0;
  const ready = (pod.status?.containerStatuses ?? []).filter((containerStatus) => containerStatus.ready)
    .length;

  return `${ready}/${total}`;
}

function getPodStatus(pod: k8s.V1Pod): string {
  const waiting = (pod.status?.containerStatuses ?? []).find(
    (containerStatus) => containerStatus.state?.waiting?.reason
  );

  if (waiting?.state?.waiting?.reason) {
    return waiting.state.waiting.reason;
  }

  const terminated = (pod.status?.containerStatuses ?? []).find(
    (containerStatus) => containerStatus.state?.terminated?.reason
  );

  if (terminated?.state?.terminated?.reason) {
    return terminated.state.terminated.reason;
  }

  return pod.status?.phase || 'Unknown';
}

function getWorkloadName(pod: k8s.V1Pod, moduleHint: ModuleHint): string {
  const labels = pod.metadata?.labels ?? {};
  const ownerName = stripReplicaSetHash(pod.metadata?.ownerReferences?.[0]?.name || '');

  if (moduleHint === 'applaunchpad') {
    return labels[APP_DEPLOY_MANAGER_LABEL] || labels[APP_LABEL] || ownerName || pod.metadata?.name || 'unknown';
  }

  if (moduleHint === 'db') {
    return labels[DB_INSTANCE_LABEL] || ownerName || pod.metadata?.name || 'unknown';
  }

  if (moduleHint === 'devbox') {
    return labels[DEVBOX_NAME_LABEL] || ownerName || pod.metadata?.name || 'unknown';
  }

  if (labels[APP_DEPLOY_MANAGER_LABEL]) {
    return labels[APP_DEPLOY_MANAGER_LABEL];
  }

  if (labels[DEVBOX_PART_OF_LABEL] === 'devbox') {
    return labels[DEVBOX_NAME_LABEL] || ownerName || pod.metadata?.name || 'unknown';
  }

  if (labels[DB_INSTANCE_LABEL] && !labels[DB_BACKUP_LABEL]) {
    return labels[DB_INSTANCE_LABEL];
  }

  return labels[APP_LABEL] || ownerName || pod.metadata?.name || 'unknown';
}

function pickModulePods(pods: k8s.V1Pod[], moduleHint: ModuleHint): k8s.V1Pod[] {
  switch (moduleHint) {
    case 'applaunchpad':
      return pods.filter((pod) => {
        const labels = pod.metadata?.labels ?? {};
        return Boolean(labels[APP_LABEL] || labels[APP_DEPLOY_MANAGER_LABEL]);
      });

    case 'db':
      return pods.filter((pod) => {
        const labels = pod.metadata?.labels ?? {};
        return Boolean(labels[DB_INSTANCE_LABEL]) && !Boolean(labels[DB_BACKUP_LABEL]);
      });

    case 'devbox':
      return pods.filter((pod) => {
        const labels = pod.metadata?.labels ?? {};
        return labels[DEVBOX_PART_OF_LABEL] === 'devbox';
      });

    default:
      return pods;
  }
}

function toPublicCandidate(candidate: ScoredPodCandidate): LogPodCandidate {
  return {
    podName: candidate.podName,
    workloadName: candidate.workloadName,
    status: candidate.status,
    ready: candidate.ready,
    restarts: candidate.restarts,
    containers: candidate.containers,
    age: candidate.age,
  };
}

function buildScoredPodCandidate(
  pod: k8s.V1Pod,
  moduleHint: ModuleHint,
  queryText: string
): ScoredPodCandidate {
  const podName = pod.metadata?.name || 'unknown';
  const workloadName = getWorkloadName(pod, moduleHint);
  const ownerName = stripReplicaSetHash(pod.metadata?.ownerReferences?.[0]?.name || '');
  const containers = getPodContainers(pod);
  const restartCount = getPodRestarts(pod);
  const status = getPodStatus(pod);
  const candidateContainers = containers.filter(
    (containerName) => !KNOWN_SIDECARS.has(containerName) || DB_MAIN_CONTAINER_PRIORITY.includes(containerName)
  );

  let textScore = 0;

  if (matchesQuery(queryText, podName)) {
    textScore = Math.max(textScore, 120);
  }

  if (matchesQuery(queryText, workloadName)) {
    textScore = Math.max(textScore, 100);
  }

  if (ownerName && matchesQuery(queryText, ownerName)) {
    textScore = Math.max(textScore, 90);
  }

  for (const containerName of candidateContainers) {
    if (matchesQuery(queryText, containerName)) {
      textScore = Math.max(textScore, 70);
    }
  }

  let healthScore = 0;

  if (status !== 'Running' && status !== 'Succeeded') {
    healthScore += 40;
  }

  healthScore += Math.min(restartCount, 20);

  return {
    rawPod: pod,
    podName,
    workloadName,
    status,
    ready: getPodReady(pod),
    restarts: restartCount,
    containers,
    age: pod.metadata?.creationTimestamp
      ? calculateAge(new Date(pod.metadata.creationTimestamp))
      : undefined,
    textScore,
    healthScore,
  };
}

function compareCandidates(a: ScoredPodCandidate, b: ScoredPodCandidate): number {
  if (b.textScore !== a.textScore) {
    return b.textScore - a.textScore;
  }

  if (b.healthScore !== a.healthScore) {
    return b.healthScore - a.healthScore;
  }

  if (b.restarts !== a.restarts) {
    return b.restarts - a.restarts;
  }

  return a.podName.localeCompare(b.podName);
}

function resolvePodCandidate(
  pods: k8s.V1Pod[],
  moduleHint: ModuleHint,
  queryText: string
): PodResolution {
  const candidates = pods
    .map((pod) => buildScoredPodCandidate(pod, moduleHint, queryText))
    .sort(compareCandidates);

  const textMatched = candidates.filter((candidate) => candidate.textScore > 0);

  if (textMatched.length === 1) {
    return {
      type: 'resolved',
      candidate: textMatched[0],
    };
  }

  if (textMatched.length > 1) {
    const [firstCandidate, secondCandidate] = textMatched;

    if (firstCandidate.textScore > secondCandidate.textScore) {
      return {
        type: 'resolved',
        candidate: firstCandidate,
      };
    }

    return {
      type: 'ambiguous_pod',
      message: 'Multiple pod candidates matched the current context.',
      candidates: textMatched.slice(0, 5).map(toPublicCandidate),
    };
  }

  if (candidates.length === 1) {
    return {
      type: 'resolved',
      candidate: candidates[0],
    };
  }

  const abnormalCandidates = candidates.filter((candidate) => candidate.healthScore > 0);

  if (abnormalCandidates.length === 1) {
    return {
      type: 'resolved',
      candidate: abnormalCandidates[0],
    };
  }

  if (abnormalCandidates.length > 1) {
    return {
      type: 'ambiguous_pod',
      message: 'More than one abnormal pod was found; unable to choose a single target safely.',
      candidates: abnormalCandidates.slice(0, 5).map(toPublicCandidate),
    };
  }

  return {
    type: 'ambiguous_pod',
    message:
      moduleHint === 'unknown'
        ? 'Multiple pod candidates were found; unable to choose a single target safely.'
        : `Multiple ${moduleHint} pod candidates were found; unable to choose a single target safely.`,
    candidates: candidates.slice(0, 5).map(toPublicCandidate),
  };
}

function resolveContainerName(
  candidate: ScoredPodCandidate,
  moduleHint: ModuleHint,
  queryText: string
): ContainerResolution {
  const containers = candidate.containers;

  if (containers.length === 1) {
    return {
      type: 'resolved',
      containerName: containers[0],
    };
  }

  const explicitMatches = containers.filter((containerName) => matchesQuery(queryText, containerName));

  if (explicitMatches.length === 1) {
    return {
      type: 'resolved',
      containerName: explicitMatches[0],
    };
  }

  if (explicitMatches.length > 1) {
    return {
      type: 'ambiguous_container',
      message: 'Multiple containers matched the current context.',
      containerCandidates: explicitMatches,
    };
  }

  if (moduleHint === 'db') {
    const mainContainer = DB_MAIN_CONTAINER_PRIORITY.find((containerName) =>
      containers.includes(containerName)
    );

    if (mainContainer) {
      return {
        type: 'resolved',
        containerName: mainContainer,
      };
    }
  }

  if (
    moduleHint === 'applaunchpad' &&
    candidate.workloadName &&
    containers.includes(candidate.workloadName)
  ) {
    return {
      type: 'resolved',
      containerName: candidate.workloadName,
    };
  }

  const nonSidecars = containers.filter((containerName) => !KNOWN_SIDECARS.has(containerName));

  if (moduleHint === 'devbox') {
    return {
      type: 'resolved',
      containerName: nonSidecars[0] || containers[0],
    };
  }

  if (nonSidecars.length === 1) {
    return {
      type: 'resolved',
      containerName: nonSidecars[0],
    };
  }

  return {
    type: 'ambiguous_container',
    message: 'Resolved pod successfully, but found more than one plausible container.',
    containerCandidates: nonSidecars.length > 0 ? nonSidecars : containers,
  };
}

async function readLogsWithFallback(
  k8sApi: k8s.CoreV1Api,
  namespace: string,
  candidate: LogPodCandidate,
  containerName: string
): Promise<{ logs: string; source: 'current' | 'previous' }> {
  let currentError: unknown;

  try {
    const currentResponse = await k8sApi.readNamespacedPodLog(
      candidate.podName,
      namespace,
      containerName,
      false,
      undefined,
      undefined,
      undefined,
      false,
      undefined,
      MAX_LOG_LINES,
      false
    );

    const currentLogs = (currentResponse.body || '').trim();

    if (currentLogs !== '') {
      return {
        logs: currentLogs,
        source: 'current',
      };
    }
  } catch (error) {
    currentError = error;
  }

  if (candidate.restarts > 0) {
    try {
      const previousResponse = await k8sApi.readNamespacedPodLog(
        candidate.podName,
        namespace,
        containerName,
        false,
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        MAX_LOG_LINES,
        false
      );

      return {
        logs: (previousResponse.body || '').trim(),
        source: 'previous',
      };
    } catch (error) {
      if (currentError) {
        throw currentError;
      }

      throw error;
    }
  }

  if (currentError) {
    throw currentError;
  }

  return {
    logs: '',
    source: 'current',
  };
}

export async function getLogsByNamespace(
  client: KubernetesClient,
  input: GetLogsByNsInput
): Promise<GetLogsResponse> {
  const validatedInput = GetLogsByNsInputSchema.parse(input);
  const rawInput =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Partial<LogsExecutionInput>)
      : {};

  const { namespace } = validatedInput;
  const queryText = buildQueryText(rawInput);
  const primaryQuery = buildPrimaryQuery(rawInput);
  const moduleHint = normalizeModuleHint(rawInput.ticketModule, queryText);

  console.error(`[Server] Executing: resolve pod logs in namespace ${namespace}`);

  try {
    const k8sApi = client.getApiClient();
    const podList = await k8sApi.listNamespacedPod(namespace);
    const modulePods = pickModulePods(podList.body.items, moduleHint);

    if (modulePods.length === 0) {
      return {
        namespace,
        moduleHint,
        resolution: 'no_match',
        query: primaryQuery,
        message:
          moduleHint === 'unknown'
            ? 'No pod candidates were found in the namespace.'
            : `No ${moduleHint} pod candidates were found in the namespace.`,
        success: true,
      };
    }

    const podResolution = resolvePodCandidate(modulePods, moduleHint, queryText);

    if (podResolution.type === 'ambiguous_pod') {
      return {
        namespace,
        moduleHint,
        resolution: 'ambiguous_pod',
        query: primaryQuery,
        message: podResolution.message,
        podCandidates: podResolution.candidates,
        success: true,
      };
    }

    const selectedPod = podResolution.candidate;
    const containerResolution = resolveContainerName(selectedPod, moduleHint, queryText);

    if (containerResolution.type === 'ambiguous_container') {
      return {
        namespace,
        moduleHint,
        resolution: 'ambiguous_container',
        query: primaryQuery,
        message: containerResolution.message,
        selectedPod: selectedPod.podName,
        podCandidates: [toPublicCandidate(selectedPod)],
        containerCandidates: containerResolution.containerCandidates,
        success: true,
      };
    }

    const logsResult = await readLogsWithFallback(
      k8sApi,
      namespace,
      selectedPod,
      containerResolution.containerName
    );

    return {
      namespace,
      moduleHint,
      resolution: 'resolved',
      query: primaryQuery,
      message:
        logsResult.logs !== ''
          ? 'Resolved target pod and container successfully.'
          : 'Resolved target pod and container, but no log output was returned.',
      selectedPod: selectedPod.podName,
      selectedContainer: containerResolution.containerName,
      logSource: logsResult.source,
      logs: logsResult.logs,
      podCandidates: [toPublicCandidate(selectedPod)],
      success: true,
    };
  } catch (error) {
    const k8sError = extractKubernetesError(error);

    console.error(`[Server] Error getting logs in namespace ${namespace}:`, {
      code: k8sError.code,
      reason: k8sError.reason,
      message: k8sError.message,
    });

    return {
      namespace,
      moduleHint,
      resolution: 'no_match',
      query: primaryQuery,
      message: 'Failed to get logs from Kubernetes.',
      error: k8sError,
      success: false,
    };
  }
}
