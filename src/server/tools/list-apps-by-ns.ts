import { ListAppsByNsInput, ListAppsByNsInputSchema } from './types';
import { KubernetesClient } from '../kubernetes/client';
import { AppInfo, KubernetesError, ListAppsResponse } from '../kubernetes/types';
import { listDeploymentsByNamespace } from './list-deployments-by-ns';
import { listStatefulSetsByNamespace } from './list-statefulsets-by-ns';

function mergeErrors(
  deploymentError?: KubernetesError,
  statefulSetError?: KubernetesError
): KubernetesError | undefined {
  const messages = [deploymentError?.message, statefulSetError?.message].filter(Boolean);

  if (messages.length === 0) {
    return undefined;
  }

  return {
    message: messages.join(' | '),
  };
}

export async function listAppsByNamespace(
  client: KubernetesClient,
  input: ListAppsByNsInput
): Promise<ListAppsResponse> {
  const validatedInput = ListAppsByNsInputSchema.parse(input);
  const { namespace } = validatedInput;

  console.error(`[Server] Executing: aggregate app workloads in namespace ${namespace}`);

  const [deploymentsResult, statefulSetsResult] = await Promise.allSettled([
    listDeploymentsByNamespace(client, { namespace }),
    listStatefulSetsByNamespace(client, { namespace }),
  ]);

  const apps: AppInfo[] = [];

  let deploymentsError: KubernetesError | undefined;
  let statefulSetsError: KubernetesError | undefined;
  let deploymentsSucceeded = false;
  let statefulSetsSucceeded = false;

  if (deploymentsResult.status === 'fulfilled') {
    const result = deploymentsResult.value;
    if (result.success) {
      deploymentsSucceeded = true;
      apps.push(
        ...result.deployments.map((deployment) => ({
          kind: 'Deployment' as const,
          ...deployment,
        }))
      );
    } else {
      deploymentsError = result.error;
    }
  } else {
    deploymentsError = {
      message:
        deploymentsResult.reason instanceof Error
          ? deploymentsResult.reason.message
          : 'Failed to list deployments',
    };
  }

  if (statefulSetsResult.status === 'fulfilled') {
    const result = statefulSetsResult.value;
    if (result.success) {
      statefulSetsSucceeded = true;
      apps.push(
        ...result.statefulsets.map((statefulset) => ({
          kind: 'StatefulSet' as const,
          ...statefulset,
        }))
      );
    } else {
      statefulSetsError = result.error;
    }
  } else {
    statefulSetsError = {
      message:
        statefulSetsResult.reason instanceof Error
          ? statefulSetsResult.reason.message
          : 'Failed to list statefulsets',
    };
  }

  const success = deploymentsSucceeded || statefulSetsSucceeded;

  if (!success) {
    return {
      namespace,
      apps: [],
      total: 0,
      error: mergeErrors(deploymentsError, statefulSetsError),
      success: false,
    };
  }

  return {
    namespace,
    apps,
    total: apps.length,
    success: true,
  };
}
