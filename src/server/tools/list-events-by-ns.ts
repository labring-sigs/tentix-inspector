import { ListEventsByNsInput, ListEventsByNsInputSchema } from './types';
import { KubernetesClient } from '../kubernetes/client';
import { KubernetesError, ListEventsResponse } from '../kubernetes/types';

/**
 * Extract meaningful error information from Kubernetes HttpError
 */
function extractKubernetesError(error: any): KubernetesError {
  // Check if it's a Kubernetes HttpError
  if (error && error.response && error.body) {
    const statusCode = error.statusCode || (error.response && error.response.statusCode);

    // Try to parse Kubernetes API error response
    let k8sError: KubernetesError = {
      code: statusCode,
      message: 'Unknown Kubernetes error',
    };

    try {
      if (typeof error.body === 'string') {
        // Parse JSON string response
        const errorBody = JSON.parse(error.body);
        k8sError = {
          code: errorBody.code || statusCode,
          reason: errorBody.reason,
          message: errorBody.message || error.body,
          details: errorBody.details,
        };
      } else if (typeof error.body === 'object') {
        // Handle object response directly
        k8sError = {
          code: error.body.code || statusCode,
          reason: error.body.reason,
          message: error.body.message || JSON.stringify(error.body),
          details: error.body.details,
        };
      }
    } catch (parseError) {
      // Fallback if parsing fails
      k8sError.message = error.message || 'Failed to parse Kubernetes error';
    }

    return k8sError;
  }

  // Handle non-Kubernetes errors
  return {
    message: error instanceof Error ? error.message : 'Unknown error occurred',
  };
}

export async function listEventsByNamespace(
  client: KubernetesClient,
  input: ListEventsByNsInput
): Promise<ListEventsResponse> {
  // Validate input
  const validatedInput = ListEventsByNsInputSchema.parse(input);
  const { namespace } = validatedInput;

  // Log execution as required
  console.error(`[Server] Executing: kubectl get events -n ${namespace} --sort-by='.lastTimestamp'`);

  try {
    const k8sApi = client.getApiClient();

    // List Event resources in the specified namespace
    const eventList = await k8sApi.listNamespacedEvent(namespace);

    // Transform Event data into an AI-friendly structure and sort by lastSeen descending
    const events = eventList.body.items
      .map((event: any) => {
        const involvedObject = event.involvedObject || event.regarding;
        const lastSeenRaw =
          event.lastTimestamp ||
          event.deprecatedLastTimestamp ||
          event.series?.lastObservedTime ||
          event.eventTime;
        const firstSeenRaw =
          event.firstTimestamp ||
          event.deprecatedFirstTimestamp ||
          lastSeenRaw;

        return {
          severity: event.type || 'Unknown',
          reason: event.reason || 'Unknown',
          resourceKind: involvedObject?.kind || 'Unknown',
          resourceName: involvedObject?.name || 'Unknown',
          subObject: involvedObject?.fieldPath || '',
          sourceComponent:
            event.source?.component ||
            event.reportingComponent ||
            event.reportingController ||
            '',
          sourceInstance:
            event.source?.host ||
            event.reportingInstance ||
            '',
          message: event.message || event.note || 'No message',
          firstSeen: firstSeenRaw ? new Date(firstSeenRaw).toISOString() : '',
          lastSeen: lastSeenRaw ? new Date(lastSeenRaw).toISOString() : '',
          count: event.count || event.deprecatedCount || event.series?.count || 1
        };
      })
      .sort((a, b) => {
        // Sort by lastSeen descending (newest first)
        const timeA = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
        const timeB = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 100); // Limit to first 100 results

    return {
      namespace,
      events,
      total: events.length,
      success: true,
    };
  } catch (error) {
    // Extract meaningful error information
    const k8sError = extractKubernetesError(error);

    // Log structured error
    console.error(`[Server] Error listing events in namespace ${namespace}:`, {
      code: k8sError.code,
      reason: k8sError.reason,
      message: k8sError.message,
    });

    // Return structured error response
    return {
      namespace,
      events: [],
      total: 0,
      error: k8sError,
      success: false,
    };
  }
}
