import { z } from 'zod';

export const ListPodsByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});


export type ListPodsByNsInput = z.infer<typeof ListPodsByNsInputSchema>;

export const LIST_PODS_BY_NS_TOOL = {
  name: 'list_pods_by_ns',
  description: 'List all pods in a specific namespace',
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
  description: 'List all devboxes in a specific namespace',
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
  description: 'List KubeBlocks clusters (databases) in a namespace',
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
  description: 'List resource quotas in a specific namespace',
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
  description: 'List Ingress resources in a specific namespace',
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

// ============================================================================
// 工具组 2：集群级别资源（不按 namespace 过滤）
// ============================================================================

// 7) Nodes 资源 - 唯一的特殊工具：namespace 参数可选但会被忽略
//    为什么要保留 namespace 参数：为了保持接口一致性（所有 list 工具都有 namespace）
//    为什么要标记为 ignored：Nodes 是集群级别资源，不属于任何 namespace
export const ListNodesInputSchema = z.object({
  namespace: z.string().optional(),
});

export type ListNodesInput = z.infer<typeof ListNodesInputSchema>;

export const LIST_NODES_TOOL = {
  name: 'list_nodes',
  description: 'List all cluster nodes',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'Ignored for cluster-level resources',
      },
    },
    required: [], // 空数组表示没有必需参数
  },
};

export const NONE_TOOL = {
  name: 'none',
  description: 'Return a fixed message only when the current user input clearly does not require any cluster query',
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
  description: 'List CronJob resources in a specific namespace',
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
  description: 'List Event resources in a specific namespace (last 100, sorted by timestamp)',
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

// 10) Account CRD - 与 Pod 工具结构完全相同
export const ListAccountByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListAccountByNsInput = z.infer<typeof ListAccountByNsInputSchema>;

export const LIST_ACCOUNT_BY_NS_TOOL = {
  name: 'list_account_by_ns',
  description: 'List Account CRD resources in a specific namespace',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: {
        type: 'string',
        description: 'The namespace to list Account CRD resources from',
      },
    },
    required: ['namespace'],
  },
};

// 11) Debt CRD - 与 Pod 工具结构完全相同
export const ListDebtByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListDebtByNsInput = z.infer<typeof ListDebtByNsInputSchema>;

export const LIST_DEBT_BY_NS_TOOL = {
  name: 'list_debt_by_ns',
  description: 'List Debt CRD resources in a specific namespace',
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

// 12) ObjectStorageBucket CRD - 与 Pod 工具结构完全相同
export const ListObjectStorageBucketByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListObjectStorageBucketByNsInput = z.infer<typeof ListObjectStorageBucketByNsInputSchema>;

export const LIST_OBJECTSTORAGEBUCKET_BY_NS_TOOL = {
  name: 'list_objectstoragebucket_by_ns',
  description: 'List ObjectStorageBucket CRD resources in a specific namespace',
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

// 13) Certificate CRD - 与 Pod 工具结构完全相同
export const ListCertificateByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

export type ListCertificateByNsInput = z.infer<typeof ListCertificateByNsInputSchema>;

export const LIST_CERTIFICATE_BY_NS_TOOL = {
  name: 'list_certificate_by_ns',
  description: 'List Certificate CRD resources in a specific namespace',
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

// ============================================================================
// 工具组 5：通用资源检查工具（inspect）
// ============================================================================

// 14) InspectResource - 唯一的多参数工具：支持资源类型、名称、namespace、可选行数
//    为什么要增加 resource/name：需要精确定位某个具体资源（不是列出所有）
//    为什么要增加 lines：控制日志输出量（只针对 Pod 资源有效）
export const InspectResourceInputSchema = z.object({
  resource: z.string().min(1, 'Resource type is required'),
  name: z.string().min(1, 'Resource name is required'),
  namespace: z.string().min(1, 'Namespace is required'),
  lines: z.number().optional().default(30), // 可选参数：.default(30) 表示未传值时默认为 30
});

export type InspectResourceInput = z.infer<typeof InspectResourceInputSchema>;

export const INSPECT_RESOURCE_TOOL = {
  name: 'inspect_resource',
  description: 'Inspect a Kubernetes resource by fetching its manifest, events, and logs (for pods)',
  inputSchema: {
    type: 'object',
    properties: {
      resource: {
        type: 'string',
        description: 'The type of resource to inspect (e.g., pod, deployment, service, devbox, cluster). Both singular and plural forms are accepted.',
      },
      name: {
        type: 'string',
        description: 'The name of the resource to inspect',
      },
      namespace: {
        type: 'string',
        description: 'The namespace where the resource is located',
      },
      lines: {
        type: 'number',
        description: 'Number of recent log lines to fetch (for pods only, default: 30)',
      },
    },
    required: ['resource', 'name', 'namespace'],
  },
};
