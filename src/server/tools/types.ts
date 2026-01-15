import { z } from 'zod';

/*
 ============================================================================
 快速上手区
 ============================================================================
 这个文件解决什么问题？
   定义 MCP (Model Context Protocol) 工具的输入验证 schema 和工具元信息。
   每个 Kubernetes 资源查询工具都需要两部分定义：
   1) Zod schema：用于在工具实现中验证输入参数（运行时验证）
   2) MCP tool definition：用于在 ListTools 响应中告诉宿主有哪些工具可用

 核心入口对象：
   这个文件没有"执行入口"，而是纯类型/常量导出模块。
   所有导出会被两处使用：
   - src/server/index.ts：导入 *_TOOL 定义并放入 ListTools 响应
   - src/server/tools/list-*.ts：导入 *InputSchema 用于验证输入

 关键数据对象：
   1) *InputSchema (z.ZodObject)：Zod 验证规则，例如 ListPodsByNsInputSchema
      → 作用：定义输入参数的结构和校验规则
   2) *Input (type)：从 schema 推断的 TypeScript 类型，例如 ListPodsByNsInput
      → 作用：给工具函数提供类型注解
   3) *_TOOL (常量对象)：MCP 工具元信息，例如 LIST_PODS_BY_NS_TOOL
      → 作用：描述工具名称、描述、输入 JSON Schema（给宿主/AI 看）

 主要副作用：
   无副作用（纯定义文件，无网络/DB/缓存/文件/全局状态操作）

 改动导航：
   1) 想新增一个 Kubernetes 资源查询工具？
      → 优先看：ListPodsByNsInputSchema 和 LIST_PODS_BY_NS_TOOL（作为模板复制）
      → 风险点：必须同时添加 Schema、Type、TOOL 三部分，否则 index.ts 或工具实现会报错
      → 验证：运行 `npx ts-node` 看类型检查是否通过
   2) 想修改某个工具的输入参数？
      → 优先看：对应的 *InputSchema（如 ListDevboxByNsInputSchema）
      → 风险点：改动后需要同步修改工具实现文件（如 list-devbox-by-ns.ts）里的参数使用
      → 验证：运行工具看 Zod 验证是否报错
   3) 想修改工具描述（显示给 AI 的提示）？
      → 优先看：对应的 *_TOOL.description（如 LIST_CLUSTER_BY_NS_TOOL.description）
      → 风险点：描述不准确会导致 AI 调用工具时传错参数
      → 验证：在宿主（Claude/ChatGPT）查看工具列表显示的描述
   4) 想给某个工具添加可选参数？
      → 优先看：InspectResourceInputSchema（它有可选参数 lines）
      → 模式：使用 z.number().optional().default(30)
 ============================================================================
*/

// ============================================================================
// 工具组 1：按 namespace 列出 Kubernetes 原生资源
// ============================================================================

// 1) 定义 Zod 验证 schema → 运行时校验 namespace 必须是非空字符串
//    为什么要校验：namespace 是 Kubernetes API 的必需参数，空值会导致 400/401 错误
export const ListPodsByNsInputSchema = z.object({
  namespace: z.string().min(1, 'Namespace is required'),
});

// 翻译：z.infer<typeof Schema> 从 Zod schema 对象推断出 TypeScript 类型
//     即：让 TypeScript 自动推导出 { namespace: string } 这样的类型
export type ListPodsByNsInput = z.infer<typeof ListPodsByNsInputSchema>;

// 2) 定义 MCP 工具元信息 → 用于 ListTools 响应，告诉宿主这个工具的存在
//    name: 工具唯一标识，调用时使用
//    description: 给 AI 的提示，说明工具用途
//    inputSchema: JSON Schema 格式，描述输入参数结构（宿主用它生成输入表单）
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

// 数据快照示例（基于代码推导）：
// ListPodsByNsInput: { namespace: "default" }
// LIST_PODS_BY_NS_TOOL.inputSchema 符合 JSON Schema 规范，会被 MCP 宿主解析

// 3) Devbox 资源（CRD）- 与 Pod 工具结构完全相同
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

// 数据快照示例（基于代码推导）：
// InspectResourceInput: { resource: "pod", name: "my-pod", namespace: "default", lines: 50 }
// InspectResourceInput (省略可选参数): { resource: "pod", name: "my-pod", namespace: "default" } → lines 自动为 30

/*
 ============================================================================
 额外输出：学习路径与改动指南
 ============================================================================
 我最该从哪 3 个对象开始读？
 1) ListPodsByNsInputSchema（第 55 行）：理解最简单工具的输入验证结构
 2) LIST_PODS_BY_NS_TOOL（第 67 行）：理解 MCP 工具元信息的结构
 3) InspectResourceInputSchema（第 349 行）：理解多参数 + 可选参数 + 默认值的高级用法

 我想改 A/B/C 功能，各自最可能改哪一段 + 风险点 + 如何验证？

 A) 新增一个 "list_services_by_ns" 工具
    → 改动点：复制 ListPodsByNsInputSchema 和 LIST_PODS_BY_NS_TOOL，改名相关标识
    → 风险点：
       - Schema 和 TOOL 定义必须成对出现，否则工具无法注册
       - 必须在 src/server/index.ts 的 tools 数组中添加导出
       - 必须创建对应的 src/server/tools/list-services-by-ns.ts 实现文件
    → 验证：
       - 运行 `npx ts-node` 检查类型错误
       - 启动 server，在宿主侧查看工具列表是否包含新工具
       - 调用新工具，确认返回预期数据

 B) 给 list_pods_by_ns 添加一个 "showLabels" 参数（控制是否返回标签）
    → 改动点：
       1) ListPodsByNsInputSchema: 添加 showLabels 字段
          export const ListPodsByNsInputSchema = z.object({
            namespace: z.string().min(1, 'Namespace is required'),
            showLabels: z.boolean().optional().default(false),
          });
       2) LIST_PODS_BY_NS_TOOL.inputSchema.properties: 添加 showLabels 定义
       3) src/server/tools/list-pods-by-ns.ts: 修改返回逻辑，根据 showLabels 决定是否包含 labels
    → 风险点：
       - 修改 Schema 后，现有调用如果不传 showLabels 不会报错（因为 .optional()）
       - 但工具实现必须读取 showLabels 参数，否则参数无效
    → 验证：
       - 传 { namespace: "default", showLabels: true }，确认返回包含 labels
       - 传 { namespace: "default" }，确认 labels 不在返回中

 C) 修改 inspect_resource 的 lines 默认值从 30 改为 100
    → 改动点：InspectResourceInputSchema 里的 .default(30) 改为 .default(100)
    → 风险点：
       - 宿主侧可能缓存了工具定义，需要重启 MCP server 才能生效
       - 现有调用如果不传 lines，会自动使用新默认值（可能增加日志量）
    → 验证：
       - 调用时不传 lines，检查返回的日志行数是否为 100
       - 调用时传 lines: 50，确认覆盖默认值，返回 50 行

 ============================================================================
*/
