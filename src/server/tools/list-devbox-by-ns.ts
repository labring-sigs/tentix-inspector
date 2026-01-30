import { ListDevboxByNsInput, ListDevboxByNsInputSchema } from './types';
import { KubernetesClient } from '../kubernetes/client';

export async function listDevboxByNamespace(client: KubernetesClient, input: ListDevboxByNsInput) {
  const validatedInput = ListDevboxByNsInputSchema.parse(input);
  const { namespace } = validatedInput;

  console.error(`[Server] Executing: kubectl get devbox -n ${namespace}`);

  try {
    const customObjectsApi = client.getCustomObjectsApi();

    const response = await customObjectsApi.listNamespacedCustomObject(
      'devbox.sealos.io',
      'v1alpha2',
      namespace,
      'devboxes'
    );

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
