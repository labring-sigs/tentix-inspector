import { z } from 'zod';

export const ListPodsByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});


export type ListPodsByNsInput = z.infer<typeof ListPodsByNsInputSchema>;

export const LIST_PODS_BY_NS_TOOL = {
  name: 'list_pods_by_ns',
  description: 'List all pods in a namespace. Use this to check the status, restarts, or basic info of Sealos App Launchpad applications (应用管理) or backend instances when users report app crashes, "preparing" state, or runtime errors.',
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
  description: 'List all DevBox CRD instances in a namespace. Use this when users report issues with their cloud IDE, DevBox project creation, environment startup, or IDE connection (like Cursor/VSCode SSH).',
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
  description: 'List database clusters (KubeBlocks) in a namespace. Use this when users report issues with databases (MySQL, PostgreSQL, Redis, MongoDB, Kafka, Milvus) such as connection failures, deployment status, or database restarts.',
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
  description: 'List resource quotas in a namespace. Use this when users report issues with creating apps/devboxes failing due to resource limits, insufficient CPU/Memory, or platform restrictions.',
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
  description: 'List Ingress resources in a namespace. Use this to check network configurations when users report issues with custom domains, external access (外网访问), CNAME resolution, or port mapping.',
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
  description: 'Return this tool ONLY when the user input is a general conversation (e.g., "hello", "thank you") or explicitly does not require querying any cluster resources. Do not use if diagnosing a technical issue.',
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
  description: 'List CronJob resources in a namespace. Use this when users report issues with scheduled tasks, Laf Cron Triggers (定时任务), or background batch jobs failing to execute.',
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
  description: 'List Event resources (last 100). CRITICAL TOOL for debugging. Use this whenever an app/DevBox is constantly restarting, stuck in "Evicted" or "Pending", or crashed to check for OOMKilled, ephemeral-storage issues, or pulling image errors.',
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
  description: 'List Debt CRD resources in a namespace. Use this when users report their instances are suspended, deleted, or show "detect abnormal" after recharging, to verify billing arrears (欠费停机) or grace period status.',
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
  description: 'List ObjectStorageBucket CRD resources. Use this when users report issues with Sealos Object Storage (对象存储), bucket access permissions (public/private), static website hosting, or SDK connection.',
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
  description: 'List Certificate CRD resources in a namespace. Use this to troubleshoot HTTPS, SSL certificate issuance, or renewal failures typically associated with Custom Domains (自定义域名) and ICP filing (备案) issues.',
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
