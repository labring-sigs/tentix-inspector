import { ListStatefulSetsByNsInput, ListStatefulSetsByNsInputSchema } from './types';
import { KubernetesClient } from '../kubernetes/client';
import { KubernetesError, ListStatefulSetsResponse, StatefulSetInfo } from '../kubernetes/types';
import * as k8s from '@kubernetes/client-node';

const PAUSE_ANNOTATION_KEY = 'deploy.cloud.sealos.io/pause';

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

function formatStorage(statefulset: k8s.V1StatefulSet): string {
  const claims = statefulset.spec?.volumeClaimTemplates ?? [];
  if (claims.length === 0) {
    return '';
  }

  return claims
    .map((claim) => {
      const path = claim.metadata?.annotations?.path || '';
      const size =
        claim.spec?.resources?.requests?.storage?.toString()
        || (claim.metadata?.annotations?.value ? `${claim.metadata.annotations.value}Gi` : '');

      return [path, size].filter(Boolean).join(',');
    })
    .filter(Boolean)
    .join('; ');
}

export async function listStatefulSetsByNamespace(
  client: KubernetesClient,
  input: ListStatefulSetsByNsInput
): Promise<ListStatefulSetsResponse> {
  const validatedInput = ListStatefulSetsByNsInputSchema.parse(input);
  const { namespace } = validatedInput;

  console.error(`[Server] Executing: kubectl get sts -n ${namespace} -o wide`);

  try {
    const appsV1Api = client.getAppsV1Api();
    const statefulSetList = await appsV1Api.listNamespacedStatefulSet(namespace);

    const statefulsets: StatefulSetInfo[] = statefulSetList.body.items.map((statefulset: k8s.V1StatefulSet) => {
      const desiredReplicas = statefulset.spec?.replicas ?? 1;
      const readyReplicas = statefulset.status?.readyReplicas ?? 0;

      const containers =
        statefulset.spec?.template?.spec?.containers
          ?.map((container) => container.name)
          .filter(Boolean) ?? [];

      const images =
        statefulset.spec?.template?.spec?.containers
          ?.map((container) => container.image || '')
          .filter(Boolean) ?? [];

      return {
        name: statefulset.metadata?.name || 'unknown',
        ready: `${readyReplicas}/${desiredReplicas}`,
        age: statefulset.metadata?.creationTimestamp
          ? calculateAge(new Date(statefulset.metadata.creationTimestamp))
          : undefined,
        containers: containers.join(', '),
        images: images.join(', '),
        storage: formatStorage(statefulset),
        paused: !!statefulset.metadata?.annotations?.[PAUSE_ANNOTATION_KEY],
      };
    });

    return {
      namespace,
      statefulsets,
      total: statefulsets.length,
      success: true,
    };
  } catch (error) {
    const k8sError = extractKubernetesError(error);

    console.error(`[Server] Error listing statefulsets in namespace ${namespace}:`, {
      code: k8sError.code,
      reason: k8sError.reason,
      message: k8sError.message,
    });

    return {
      namespace,
      statefulsets: [],
      total: 0,
      error: k8sError,
      success: false,
    };
  }
}
