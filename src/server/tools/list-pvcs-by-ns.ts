import { ListPvcsByNsInput, ListPvcsByNsInputSchema } from './types';
import { KubernetesClient } from '../kubernetes/client';
import { KubernetesError, ListPvcsResponse, PVCInfo } from '../kubernetes/types';
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

function formatAccessModes(accessModes?: string[]): string {
  if (!accessModes || accessModes.length === 0) {
    return '';
  }

  return accessModes
    .map((mode) => {
      switch (mode) {
        case 'ReadWriteOnce':
          return 'RWO';
        case 'ReadOnlyMany':
          return 'ROX';
        case 'ReadWriteMany':
          return 'RWX';
        case 'ReadWriteOncePod':
          return 'RWOP';
        default:
          return mode;
      }
    })
    .join(',');
}

export async function listPvcsByNamespace(
  client: KubernetesClient,
  input: ListPvcsByNsInput
): Promise<ListPvcsResponse> {
  const validatedInput = ListPvcsByNsInputSchema.parse(input);
  const { namespace } = validatedInput;

  console.error(`[Server] Executing: kubectl get pvc -n ${namespace} -o wide`);

  try {
    const k8sApi = client.getApiClient();
    const pvcList = await k8sApi.listNamespacedPersistentVolumeClaim(namespace);

    const pvcs: PVCInfo[] = pvcList.body.items.map((pvc: k8s.V1PersistentVolumeClaim) => ({
      name: pvc.metadata?.name || 'unknown',
      status: pvc.status?.phase || 'Unknown',
      volume: pvc.spec?.volumeName || '',
      capacity: pvc.status?.capacity?.storage?.toString() || pvc.spec?.resources?.requests?.storage?.toString() || '',
      accessModes: formatAccessModes(pvc.status?.accessModes || pvc.spec?.accessModes),
      storageClass: pvc.spec?.storageClassName || '',
      age: pvc.metadata?.creationTimestamp
        ? calculateAge(new Date(pvc.metadata.creationTimestamp))
        : undefined,
      volumeMode: pvc.spec?.volumeMode || 'Filesystem',
    }));

    return {
      namespace,
      pvcs,
      total: pvcs.length,
      success: true,
    };
  } catch (error) {
    const k8sError = extractKubernetesError(error);

    console.error(`[Server] Error listing PVCs in namespace ${namespace}:`, {
      code: k8sError.code,
      reason: k8sError.reason,
      message: k8sError.message,
    });

    return {
      namespace,
      pvcs: [],
      total: 0,
      error: k8sError,
      success: false,
    };
  }
}
