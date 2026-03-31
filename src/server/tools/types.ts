import { z } from 'zod';

export const ListPodsByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});


export type ListPodsByNsInput = z.infer<typeof ListPodsByNsInputSchema>;

export const LIST_PODS_BY_NS_TOOL = {
  name: 'list_pods_by_ns',
  description: 'List all pods in a namespace. Prefer this for runtime overview and target identification, such as checking which workload is unhealthy, not ready, restarting, or missing, before deciding whether to inspect events or logs. Use this when users report symptoms like "application not starting", "preparing for a long time", "service unavailable", "restarting", or "which instance is abnormal", but the exact target workload is still unclear.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to list pods from',
      },
    },
    required: ['namespace'],
  },
};


export const ListDevboxByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListDevboxByNsInput = z.infer<typeof ListDevboxByNsInputSchema>;

export const LIST_DEVBOX_BY_NS_TOOL = {
  name: 'list_devbox_by_ns',
  description: 'List all DevBox CRD instances in a namespace. Prefer this for DevBox product-level diagnosis, such as whether the DevBox instance exists, is starting, stopped, released, or in an abnormal lifecycle state, and when users report IDE startup issues, SSH connection issues, public access issues, or DevBox environment availability problems. This is not the primary tool for container stdout/stderr; use logs when the DevBox workload itself needs runtime process evidence.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to list devboxes from',
      },
    },
    required: ['namespace'],
  },
};

// 4) Cluster 资源（KubeBlocks CRD）- 与 Pod 工具结构完全相同
export const ListClusterByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListClusterByNsInput = z.infer<typeof ListClusterByNsInputSchema>;

export const LIST_CLUSTER_BY_NS_TOOL = {
  name: 'list_cluster_by_ns',
  description: 'List database clusters (KubeBlocks) in a namespace. Prefer this for Sealos Database (数据库) resource-level diagnosis, such as database instance status, deployment phase, component health, connection information, scaling state, or whether the database resource itself is abnormal. Use logs only when runtime database process output is needed after the database instance has been identified.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to list clusters from',
      },
    },
    required: ['namespace'],
  },
};

// 5) Quota 资源 - 与 Pod 工具结构完全相同
export const ListQuotaByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListQuotaByNsInput = z.infer<typeof ListQuotaByNsInputSchema>;

export const LIST_QUOTA_BY_NS_TOOL = {
  name: 'list_quota_by_ns',
  description: 'List resource quotas in a namespace. Prefer this when users report that apps, databases, or DevBox instances cannot be created, expanded, or started because of resource limits, insufficient CPU or memory, storage quota exhaustion, or platform-side capacity restrictions. This is not the tool for application runtime errors inside containers.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to list quotas from',
      },
    },
    required: ['namespace'],
  },
};

// 6) Ingress 资源 - 与 Pod 工具结构完全相同
export const ListIngressByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListIngressByNsInput = z.infer<typeof ListIngressByNsInputSchema>;

export const LIST_INGRESS_BY_NS_TOOL = {
  name: 'list_ingress_by_ns',
  description: 'List Ingress resources in a namespace. Prefer this when users report custom domain, external access (外网访问), CNAME resolution, HTTPS, host routing, or port exposure problems, especially when the application may be healthy but traffic cannot reach it correctly from outside the cluster. This is not the first tool for application runtime exceptions inside the container.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to list Ingress resources from',
      },
    },
    required: ['namespace'],
  },
};

export const NONE_TOOL = {
  name: 'none',
  description: 'Return this tool when the current user input does not require querying cluster resources right now, such as greetings, thanks, confirmations, clarification-only replies, or discussion/questions that can be answered from existing context. Also use this when the current turn is only continuing an explanation of already retrieved results and no fresh cluster state is needed. Do not use this tool if answering the current request depends on checking live cluster or namespace state.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

// ============================================================================
// 工具组 3：按 namespace 列出 Kubernetes 原生资源（续）
// ============================================================================

// 8) CronJob 资源 - 与 Pod 工具结构完全相同
export const ListCronjobsByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListCronjobsByNsInput = z.infer<typeof ListCronjobsByNsInputSchema>;

export const LIST_CRONJOBS_BY_NS_TOOL = {
  name: 'list_cronjobs_by_ns',
  description: 'List CronJob resources in a namespace. Prefer this when users report scheduled tasks not running, tasks running at the wrong time, repeated scheduled job failures, missing batch executions, or Laf Cron Trigger (定时任务) problems. This is the scheduling-layer tool, not the primary tool for diagnosing runtime stdout/stderr inside an already identified pod.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to list CronJob resources from',
      },
    },
    required: ['namespace'],
  },
};

// 9) Events 资源 - 与 Pod 工具结构完全相同
export const ListEventsByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListEventsByNsInput = z.infer<typeof ListEventsByNsInputSchema>;

export const LIST_EVENTS_BY_NS_TOOL = {
  name: 'list_events_by_ns',
  description: 'List recent Kubernetes events (last 100) in a namespace. Prefer this for Kubernetes or platform lifecycle failures rather than application stdout/stderr, such as Pending, FailedScheduling, ErrImagePull, ImagePullBackOff, Evicted, OOMKilled, mount failures, probe failures, node issues, or workloads stuck in preparing before the main process is actually running. This is usually the first step when the platform may be preventing the workload from starting correctly.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to list Event resources from',
      },
    },
    required: ['namespace'],
  },
};

// ============================================================================
// 工具组 4：按 namespace 列出 CRD 资源
// ============================================================================

// 10) Debt CRD - 与 Pod 工具结构完全相同
export const ListDebtByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListDebtByNsInput = z.infer<typeof ListDebtByNsInputSchema>;

export const LIST_DEBT_BY_NS_TOOL = {
  name: 'list_debt_by_ns',
  description: 'List Debt CRD resources in a namespace. Prefer this when users report instances being suspended, stopped, deleted, still abnormal after recharge, or showing signs of billing-related shutdown. Use this to diagnose arrears (欠费), grace-period, or post-recharge recovery issues rather than application runtime failures.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to list Debt CRD resources from',
      },
    },
    required: ['namespace'],
  },
};

// 11) ObjectStorageBucket CRD - 与 Pod 工具结构完全相同
export const ListObjectStorageBucketByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListObjectStorageBucketByNsInput = z.infer<typeof ListObjectStorageBucketByNsInputSchema>;

export const LIST_OBJECTSTORAGEBUCKET_BY_NS_TOOL = {
  name: 'list_objectstoragebucket_by_ns',
  description: 'List ObjectStorageBucket CRD resources in a namespace. Prefer this when users report Sealos Object Storage (对象存储) problems such as bucket not existing, bucket access permission issues, public/private policy problems, static website hosting problems, SDK connection errors, or bucket-level configuration issues. Do not use PVC tools for these object storage bucket problems.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to list ObjectStorageBucket CRD resources from',
      },
    },
    required: ['namespace'],
  },
};

// 12) Certificate CRD - 与 Pod 工具结构完全相同
export const ListCertificateByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListCertificateByNsInput = z.infer<typeof ListCertificateByNsInputSchema>;

export const LIST_CERTIFICATE_BY_NS_TOOL = {
  name: 'list_certificate_by_ns',
  description: 'List Certificate CRD resources in a namespace. Prefer this when users report HTTPS failures, SSL certificate issuance or renewal problems, custom domain certificate errors, or ICP filing (备案) related certificate issues, especially when the domain is configured but secure access is still failing.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to list Certificate CRD resources from',
      },
    },
    required: ['namespace'],
  },
};

export const ListDeploymentsByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListDeploymentsByNsInput = z.infer<typeof ListDeploymentsByNsInputSchema>;

export const LIST_DEPLOYMENTS_BY_NS_TOOL = {
  name: 'list_deployments_by_ns',
  description: 'List Deployment resources in a namespace. Prefer this when you specifically need to isolate stateless application workloads after identifying that the issue belongs to Sealos App Launchpad (应用管理), especially for configuration diagnosis such as replica state, image rollout, stateless workload readiness, or confirming that the target app is managed as a Deployment. Prefer list_apps_by_ns first unless stateless workloads must be isolated.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to list Deployment resources from',
      },
    },
    required: ['namespace'],
  },
};

export const ListStatefulSetsByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListStatefulSetsByNsInput = z.infer<typeof ListStatefulSetsByNsInputSchema>;

export const LIST_STATEFULSETS_BY_NS_TOOL = {
  name: 'list_statefulsets_by_ns',
  description: 'List StatefulSet resources in a namespace. Prefer this when you specifically need to isolate stateful application workloads after identifying that the issue belongs to Sealos App Launchpad (应用管理), especially for persistent storage, mounted data paths, volume-backed workloads, replica identity, or confirming that the target app is managed as a StatefulSet. Prefer list_apps_by_ns first unless stateful workloads must be isolated.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to list StatefulSet resources from',
      },
    },
    required: ['namespace'],
  },
};

export const ListAppsByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListAppsByNsInput = z.infer<typeof ListAppsByNsInputSchema>;

export const LIST_APPS_BY_NS_TOOL = {
  name: 'list_apps_by_ns',
  description: 'List application workloads (combined Deployments and StatefulSets) in a namespace. This is the PRIMARY tool for configuration-level diagnosis of Sealos App Launchpad (应用管理) apps, especially when users report environment variables not taking effect, startup commands being wrong, image names or versions being incorrect, ports being misconfigured, storage settings being wrong, or general app configuration changes not applying as expected. This is not the primary tool for runtime stdout/stderr evidence.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to list application workloads from',
      },
    },
    required: ['namespace'],
  },
};

export const ListPvcsByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListPvcsByNsInput = z.infer<typeof ListPvcsByNsInputSchema>;

export const LIST_PVCS_BY_NS_TOOL = {
  name: 'list_pvcs_by_ns',
  description: 'List PersistentVolumeClaim (PVC) resources in a namespace. Prefer this when users report persistent storage (持久化存储) problems such as disk full, storage capacity exhaustion, PVC Pending or Bound issues, mounted data not appearing, volume attach problems, or application/database local volume problems. STRICTLY DO NOT use this for Object Storage (对象存储) bucket issues.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to list PVC resources from',
      },
    },
    required: ['namespace'],
  },
};

export const GetLogsByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type GetLogsByNsInput = z.infer<typeof GetLogsByNsInputSchema>;

export const GET_LOGS_BY_NS_TOOL = {
  name: 'get_logs_by_ns',
  description: 'Get recent container logs from the most relevant runtime workload in a namespace. The tool can automatically resolve the target pod and container from ticket context, so the user does NOT need to provide an exact pod name. Prefer this when the problem likely comes from the application or process itself, such as startup failures, repeated restarts, CrashLoopBackOff, entrypoint or command errors, runtime exceptions, backend startup failures, "local works but Sealos fails", application-level connection/subscription errors, or cases where the service is running but business behavior is abnormal. Do NOT prefer this as the first step for Pending, FailedScheduling, ImagePullBackOff, PVC/storage, custom domain/Ingress/SSL, quota, or billing issues unless runtime stdout/stderr evidence is clearly needed after other checks.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to get logs from',
      },
    },
    required: ['namespace'],
  },
};
