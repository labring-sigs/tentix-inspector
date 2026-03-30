import * as k8s from '@kubernetes/client-node';
import * as path from 'path';

const K8S_REQUEST_TIMEOUT_MS = Number(process.env.K8S_REQUEST_TIMEOUT_MS ?? 60_000);

function attachRequestTimeout(
  client:
    | k8s.CoreV1Api
    | k8s.CustomObjectsApi
    | k8s.NetworkingV1Api
    | k8s.BatchV1Api
    | k8s.AppsV1Api,
  timeoutMs: number
): void {
  client.addInterceptor((requestOptions) => {
    requestOptions.timeout = timeoutMs;
  });
}

export class KubernetesClient {
  private kc: k8s.KubeConfig;
  private k8sApi: k8s.CoreV1Api;
  private customObjectsApi: k8s.CustomObjectsApi;
  private networkingV1Api: k8s.NetworkingV1Api;
  private batchV1Api: k8s.BatchV1Api;
  private appsV1Api: k8s.AppsV1Api;

  constructor(kubeconfigPath?: string, kubeconfigContent?: string) {
    this.kc = new k8s.KubeConfig();

    // Load from kubeconfig content first (highest priority), then file, then default
    if (kubeconfigContent) {
      this.kc.loadFromString(kubeconfigContent);
    } else if (kubeconfigPath) {
      this.kc.loadFromFile(kubeconfigPath);
    } else {
      this.kc.loadFromDefault();
    }

    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.customObjectsApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
    this.networkingV1Api = this.kc.makeApiClient(k8s.NetworkingV1Api);
    this.batchV1Api = this.kc.makeApiClient(k8s.BatchV1Api);
    this.appsV1Api = this.kc.makeApiClient(k8s.AppsV1Api);

    attachRequestTimeout(this.k8sApi, K8S_REQUEST_TIMEOUT_MS);
    attachRequestTimeout(this.customObjectsApi, K8S_REQUEST_TIMEOUT_MS);
    attachRequestTimeout(this.networkingV1Api, K8S_REQUEST_TIMEOUT_MS);
    attachRequestTimeout(this.batchV1Api, K8S_REQUEST_TIMEOUT_MS);
    attachRequestTimeout(this.appsV1Api, K8S_REQUEST_TIMEOUT_MS);
  }

  /**
   * Get the Kubernetes API client
   */
  getApiClient(): k8s.CoreV1Api {
    return this.k8sApi;
  }

  /**
   * Get the Custom Objects API client for CRDs
   */
  getCustomObjectsApi(): k8s.CustomObjectsApi {
    return this.customObjectsApi;
  }

  /**
   * Get the Networking V1 API client for Ingress resources
   */
  getNetworkingV1Api(): k8s.NetworkingV1Api {
    return this.networkingV1Api;
  }

  /**
   * Get the Batch V1 API client for CronJob resources
   */
  getBatchV1Api(): k8s.BatchV1Api {
    return this.batchV1Api;
  }

  /**
   * Get the Apps V1 API client for Deployment resources
   */
  getAppsV1Api(): k8s.AppsV1Api {
    return this.appsV1Api;
  }

  /**
   * Test connection to the cluster
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try a simple API call to check connectivity
      await this.k8sApi.getAPIResources();
      return true;
    } catch (error: any) {
      // Extract meaningful error information without printing full stack trace
      let errorMessage = 'Unknown connection error';

      if (error.response && error.response.body && error.response.body.message) {
        errorMessage = error.response.body.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      console.error(`[KubernetesClient] Connection test failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Get current context information
   */
  getCurrentContext(): any {
    return this.kc.getCurrentContext();
  }
}

// Export a singleton instance with the project's kubeconfig
export const kubernetesClient = new KubernetesClient(
  path.join(process.cwd(), 'kubeconfig', 'hzh-kubeconfig')
);
