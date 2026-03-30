import { ListDeploymentsByNsInput, ListDeploymentsByNsInputSchema } from './types';
import { KubernetesClient } from '../kubernetes/client';
import { DeploymentInfo, KubernetesError, ListDeploymentsResponse } from '../kubernetes/types';
import * as k8s from '@kubernetes/client-node';

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

function formatSelector(selector?: k8s.V1LabelSelector): string {
  if (!selector) {
    return '';
  }

  const parts: string[] = [];

  if (selector.matchLabels) {
    parts.push(
      ...Object.entries(selector.matchLabels).map(([key, value]) => `${key}=${value}`)
    );
  }

  if (selector.matchExpressions) {
    for (const expr of selector.matchExpressions) {
      const values = expr.values?.join(',') || '';

      switch (expr.operator) {
        case 'In':
          parts.push(`${expr.key} in (${values})`);
          break;
        case 'NotIn':
          parts.push(`${expr.key} notin (${values})`);
          break;
        case 'Exists':
          parts.push(expr.key);
          break;
        case 'DoesNotExist':
          parts.push(`!${expr.key}`);
          break;
      }
    }
  }

  return parts.join(',');
}

export async function listDeploymentsByNamespace(
  client: KubernetesClient,
  input: ListDeploymentsByNsInput
): Promise<ListDeploymentsResponse> {
  const validatedInput = ListDeploymentsByNsInputSchema.parse(input);
  const { namespace } = validatedInput;

  console.error(`[Server] Executing: kubectl get deployment -n ${namespace} -o wide`);

  try {
    const appsV1Api = client.getAppsV1Api();
    const deploymentList = await appsV1Api.listNamespacedDeployment(namespace);

    const deployments: DeploymentInfo[] = deploymentList.body.items.map((deployment: k8s.V1Deployment) => {
      const desiredReplicas = deployment.spec?.replicas ?? 1;
      const readyReplicas = deployment.status?.readyReplicas ?? 0;
      const upToDate = deployment.status?.updatedReplicas ?? 0;
      const available = deployment.status?.availableReplicas ?? 0;

      const containers =
        deployment.spec?.template?.spec?.containers
          ?.map((container) => container.name)
          .filter(Boolean) ?? [];

      const images =
        deployment.spec?.template?.spec?.containers
          ?.map((container) => container.image || '')
          .filter(Boolean) ?? [];

      return {
        name: deployment.metadata?.name || 'unknown',
        ready: `${readyReplicas}/${desiredReplicas}`,
        upToDate,
        available,
        age: deployment.metadata?.creationTimestamp
          ? calculateAge(new Date(deployment.metadata.creationTimestamp))
          : undefined,
        containers: containers.join(', '),
        images: images.join(', '),
        selector: formatSelector(deployment.spec?.selector),
        paused: deployment.spec?.paused ?? false,
      };
    });

    return {
      namespace,
      deployments,
      total: deployments.length,
      success: true,
    };
  } catch (error) {
    const k8sError = extractKubernetesError(error);

    console.error(`[Server] Error listing deployments in namespace ${namespace}:`, {
      code: k8sError.code,
      reason: k8sError.reason,
      message: k8sError.message,
    });

    return {
      namespace,
      deployments: [],
      total: 0,
      error: k8sError,
      success: false,
    };
  }
}
