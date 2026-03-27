import { ListDevboxByNsInput, ListDevboxByNsInputSchema } from './types';
import { KubernetesClient } from '../kubernetes/client';

type DevboxApiVersion = 'v1alpha1' | 'v1alpha2';

let cachedDevboxApiVersion: DevboxApiVersion | undefined;

function isNotFoundError(error: any): boolean {
  return error?.statusCode === 404 || error?.response?.statusCode === 404;
}

async function listNamespacedDevboxes(
  client: KubernetesClient,
  namespace: string
): Promise<any> {
  const customObjectsApi = client.getCustomObjectsApi();

  const versions: DevboxApiVersion[] = cachedDevboxApiVersion
    ? [
        cachedDevboxApiVersion,
        ...(cachedDevboxApiVersion === 'v1alpha2'
          ? (['v1alpha1'] as DevboxApiVersion[])
          : (['v1alpha2'] as DevboxApiVersion[])),
      ]
    : ['v1alpha2', 'v1alpha1'];

  let lastNotFoundError: any;

  for (const version of versions) {
    try {
      const response = await customObjectsApi.listNamespacedCustomObject(
        'devbox.sealos.io',
        version,
        namespace,
        'devboxes'
      );

      cachedDevboxApiVersion = version;
      return response;
    } catch (error: any) {
      if (isNotFoundError(error)) {
        lastNotFoundError = error;
        continue;
      }

      throw error;
    }
  }

  cachedDevboxApiVersion = undefined;
  throw lastNotFoundError ?? new Error('Devbox API not found');
}

export async function listDevboxByNamespace(client: KubernetesClient, input: ListDevboxByNsInput) {
  const validatedInput = ListDevboxByNsInputSchema.parse(input);
  const { namespace } = validatedInput;

  console.error(`[Server] Executing: kubectl get devbox -n ${namespace}`);

  try {
    const response = await listNamespacedDevboxes(client, namespace);

    const devboxes = (response.body as any).items?.map((item: any) => ({
      name: item.metadata?.name || 'unknown',
      status: item.status?.phase || item.status?.state || 'Unknown',
      network: item.status?.network || {},
    })) || [];

    return {
      namespace,
      devboxes,
      total: devboxes.length,
      success: true,
    };
  } catch (error: any) {
    console.error(`[Server] Error listing devboxes in namespace ${namespace}:`, error);

    let errorMessage = 'Unknown error occurred';
    if (error.response?.body?.message) {
      errorMessage = error.response.body.message;
    } else if (typeof error.response?.body === 'string' && error.response.body.trim() !== '') {
      errorMessage = error.response.body.trim();
    } else if (typeof error.body === 'string' && error.body.trim() !== '') {
      errorMessage = error.body.trim();
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      namespace,
      devboxes: [],
      total: 0,
      error: errorMessage,
      success: false,
    };
  }
}
