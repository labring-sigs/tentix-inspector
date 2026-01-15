import express, { Request, Response } from 'express';
import * as path from 'path';
import { KubernetesClient } from './kubernetes/client';

// Import all tool functions
import { listPodsByNamespace } from './tools/list-pods-by-ns';
import { listDevboxByNamespace } from './tools/list-devbox-by-ns';
import { listClusterByNamespace } from './tools/list-cluster-by-ns';
import { listQuotaByNamespace } from './tools/list-quota-by-ns';
import { listIngressByNamespace } from './tools/list-ingress-by-ns';
import { listNodes } from './tools/list-nodes';
import { listCronjobsByNamespace } from './tools/list-cronjobs-by-ns';
import { listEventsByNamespace } from './tools/list-events-by-ns';
import { listAccountByNamespace } from './tools/list-account-by-ns';
import { listDebtByNamespace } from './tools/list-debt-by-ns';
import { listObjectStorageBucketByNamespace } from './tools/list-objectstoragebucket-by-ns';
import { listCertificateByNamespace } from './tools/list-certificate-by-ns';
import { inspectResource } from './tools/inspect-resource';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

/*
 ============================================================================
 快速上手区
 ============================================================================
 这个文件解决什么问题？
   提供 HTTP REST API 来查询 Kubernetes 资源（与 MCP server 功能相同，但接口不同）。
   负责：
   1) 启动 Express HTTP 服务器监听指定端口
   2) 支持 multi-zone（不同 zone 使用不同的 kubeconfig 文件）
   3) 提供与 MCP server 相同的 13 个工具的 HTTP 接口
   4) 处理 HTTP 请求/响应，将查询结果返回为 JSON

 核心入口函数：
   startServer() (第 533 行)：异步主函数，启动 HTTP 服务器

 关键数据对象：
   1) ZONE_KUBECONFIG_MAP (第 84-89 行)：zone 到 kubeconfig 文件路径的映射
      → 作用：根据 URL 参数 ?zone=xxx 选择对应的 kubeconfig
   2) app (Express 实例)：Express 应用实例
      → 来自 express()，负责注册路由和中间件
   3) global.kubernetesClient：全局变量，存储当前使用的 Kubernetes 客户端
      → 工具函数通过这个全局变量访问客户端（hack 方式）

 主要副作用：
   - 网络：监听 HTTP 端口（默认 3000）
   - 全局状态：修改 global.kubernetesClient 切换不同 zone 的客户端
   - 文件：读取 kubeconfig 文件（在 KubernetesClient 构造函数中）
   - 日志：向 stderr 输出运行时日志

 改动导航：
   1) 想新增一个 HTTP API 端点（如 /api/services）？
      → 优先看：第 6-18 行（导入工具函数）、第 159-184 行（API 端点模板）
      → 需要同步修改：
         - 在第 6-18 行添加工具函数导入
         - 复制第 159-184 行的模式，修改路由和工具调用
      → 验证：curl 测试新端点，确认返回预期数据
   2) 想添加新的 zone（如 'shanghai'）？
      → 优先看：第 84-89 行（ZONE_KUBECONFIG_MAP）
      → 需要同步修改：
         - 添加 kubeconfig/shanghai-kubeconfig 文件
         - 在 ZONE_KUBECONFIG_MAP 中添加映射
      → 验证：curl "?zone=shanghai" 测试，确认使用正确的 kubeconfig
   3) 想修改默认端口（从 3000 改为 8080）？
      → 优先看：第 21 行（PORT 定义）
      → 风险点：需要更新防火墙规则、文档中的端口引用
      → 验证：启动 server，确认监听在新端口
   4) 想添加身份验证（如 API Key）？
      → 优先看：第 24 行（app.use(express.json())）
      → 在此处添加验证中间件，或在每个路由前添加验证逻辑
 ============================================================================
*/

// ============================================================================
// Zone 到 Kubeconfig 路径的映射
// ============================================================================

// 1) 定义 zone 映射 → 每个 zone 对应一个 kubeconfig 文件
//    为什么要用映射：支持多集群/多环境部署（hzh/bja/gzg 是不同区域）
const ZONE_KUBECONFIG_MAP: Record<string, string> = {
  'hzh': path.join(process.cwd(), 'kubeconfig', 'hzh-kubeconfig'),
  'bja': path.join(process.cwd(), 'kubeconfig', 'bja-kubeconfig'),
  'gzg': path.join(process.cwd(), 'kubeconfig', 'gzg-kubeconfig'),
  'default': path.join(process.cwd(), 'kubeconfig', 'Mykubeconfig'),
};

// ============================================================================
// 辅助函数：根据 zone 获取 Kubernetes 客户端
// ============================================================================

/**
 * 【用途】根据 zone 创建 KubernetesClient 实例
 * 【上游/下游】被所有 API 端点调用 → 内部调用 new KubernetesClient(kubeconfigPath)
 * 【核心流程】
 *   1) 解析 zone 参数，未提供则使用 'default'
 *   2) 从 ZONE_KUBECONFIG_MAP 查找 kubeconfig 路径
 *   3) 创建 KubernetesClient 实例并返回
 * 【错误与边界】
 *   - zone 不存在时 fallback 到 'default'（第 110 行）
 *   - 创建失败时 fallback 到 'default'（第 117-118 行）
 */
function getK8sClientByZone(zone?: string): KubernetesClient {
  // 翻译：zone || 'default' - 空值合并运算符（||）
  //     如果 zone 为 falsy（undefined/null/''），则使用 'default'
  const selectedZone = zone || 'default';
  const kubeconfigPath = ZONE_KUBECONFIG_MAP[selectedZone] || ZONE_KUBECONFIG_MAP['default'];

  console.error(`[HTTP] Using zone: ${selectedZone} -> ${kubeconfigPath}`);

  try {
    return new KubernetesClient(kubeconfigPath);
  } catch (error) {
    console.error(`[HTTP] Failed to create client for zone ${selectedZone}, using default`);
    return new KubernetesClient(ZONE_KUBECONFIG_MAP['default']);
  }
}

// ============================================================================
// 健康检查端点
// ============================================================================

// 2) 健康检查端点 → 用于监控服务是否正常运行、能否连接到 Kubernetes
//    为什么要单独提供：监控系统（如 Kubernetes liveness probe）需要检查服务健康
app.get('/health', async (req: Request, res: Response) => {
  const zone = req.query.zone as string;
  try {
    const client = getK8sClientByZone(zone);
    const isConnected = await client.testConnection();
    const context = client.getCurrentContext();

    res.json({
      status: isConnected ? 'healthy' : 'unhealthy',
      zone: zone || 'default',
      cluster: context?.cluster,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// API 端点组：列出各种 Kubernetes 资源
// ============================================================================

// 3) API 端点模板 → 所有 list 端点遵循相同的模式
//    模式：获取参数 → 验证 → 切换客户端 → 调用工具 → 恢复客户端 → 返回结果
//    为什么要切换客户端：工具函数从 global.kubernetesClient 获取客户端（hack）
//    为什么要恢复原客户端：避免影响其他请求（global 是共享的）

// API: None（兜底端点：脱离 kubeconfig，无论参数是什么都返回“空”）
// - 需求：只要路径以 /api/none 开头（例如 /api/none?zone=xxx&namespace=yyy），都返回固定结果
// - 设计：用 app.use 做前缀匹配，并且不触碰 global.kubernetesClient
app.use('/api/none', (_req: Request, res: Response) => {
  return res.json({ result: '空' });
});

// API: List Pods
app.get('/api/pods', async (req: Request, res: Response) => {
  try {
    const { namespace, zone } = req.query;

    if (!namespace) {
      return res.status(400).json({ error: 'namespace parameter is required' });
    }

    const client = getK8sClientByZone(zone as string);
    // 4) 保存原客户端 → 用于请求结束后恢复
    //    为什么要保存：global.kubernetesClient 是全局共享的，其他请求可能正在使用
    const originalClient = (global as any).kubernetesClient;
    (global as any).kubernetesClient = client;

    const result = await listPodsByNamespace({ namespace: namespace as string });

    // 5) 恢复原客户端 → 避免影响后续请求
    //    为什么要恢复：如果不恢复，后续请求会错误地使用当前请求的客户端
    (global as any).kubernetesClient = originalClient;
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API: List Devbox
app.get('/api/devbox', async (req: Request, res: Response) => {
  try {
    const { namespace, zone } = req.query;

    if (!namespace) {
      return res.status(400).json({ error: 'namespace parameter is required' });
    }

    const client = getK8sClientByZone(zone as string);
    const originalClient = (global as any).kubernetesClient;
    (global as any).kubernetesClient = client;

    const result = await listDevboxByNamespace({ namespace: namespace as string });

    (global as any).kubernetesClient = originalClient;
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API: List Cluster
app.get('/api/cluster', async (req: Request, res: Response) => {
  try {
    const { namespace, zone } = req.query;

    if (!namespace) {
      return res.status(400).json({ error: 'namespace parameter is required' });
    }

    const client = getK8sClientByZone(zone as string);
    const originalClient = (global as any).kubernetesClient;
    (global as any).kubernetesClient = client;

    const result = await listClusterByNamespace({ namespace: namespace as string });

    (global as any).kubernetesClient = originalClient;
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API: List Quota
app.get('/api/quota', async (req: Request, res: Response) => {
  try {
    const { namespace, zone } = req.query;

    if (!namespace) {
      return res.status(400).json({ error: 'namespace parameter is required' });
    }

    const client = getK8sClientByZone(zone as string);
    const originalClient = (global as any).kubernetesClient;
    (global as any).kubernetesClient = client;

    const result = await listQuotaByNamespace({ namespace: namespace as string });

    (global as any).kubernetesClient = originalClient;
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API: List Ingress
app.get('/api/ingress', async (req: Request, res: Response) => {
  try {
    const { namespace, zone } = req.query;

    if (!namespace) {
      return res.status(400).json({ error: 'namespace parameter is required' });
    }

    const client = getK8sClientByZone(zone as string);
    const originalClient = (global as any).kubernetesClient;
    (global as any).kubernetesClient = client;

    const result = await listIngressByNamespace({ namespace: namespace as string });

    (global as any).kubernetesClient = originalClient;
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API: List Nodes（唯一的特殊端点：不需要 namespace 参数）
app.get('/api/nodes', async (req: Request, res: Response) => {
  try {
    const { zone } = req.query;

    const client = getK8sClientByZone(zone as string);
    const originalClient = (global as any).kubernetesClient;
    (global as any).kubernetesClient = client;

    const result = await listNodes({});

    (global as any).kubernetesClient = originalClient;
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API: List CronJobs
app.get('/api/cronjobs', async (req: Request, res: Response) => {
  try {
    const { namespace, zone } = req.query;

    if (!namespace) {
      return res.status(400).json({ error: 'namespace parameter is required' });
    }

    const client = getK8sClientByZone(zone as string);
    const originalClient = (global as any).kubernetesClient;
    (global as any).kubernetesClient = client;

    const result = await listCronjobsByNamespace({ namespace: namespace as string });

    (global as any).kubernetesClient = originalClient;
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API: List Events
app.get('/api/events', async (req: Request, res: Response) => {
  try {
    const { namespace, zone } = req.query;

    if (!namespace) {
      return res.status(400).json({ error: 'namespace parameter is required' });
    }

    const client = getK8sClientByZone(zone as string);
    const originalClient = (global as any).kubernetesClient;
    (global as any).kubernetesClient = client;

    const result = await listEventsByNamespace({ namespace: namespace as string });

    (global as any).kubernetesClient = originalClient;
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API: List Account
app.get('/api/account', async (req: Request, res: Response) => {
  try {
    const { namespace, zone } = req.query;

    if (!namespace) {
      return res.status(400).json({ error: 'namespace parameter is required' });
    }

    const client = getK8sClientByZone(zone as string);
    const originalClient = (global as any).kubernetesClient;
    (global as any).kubernetesClient = client;

    const result = await listAccountByNamespace({ namespace: namespace as string });

    (global as any).kubernetesClient = originalClient;
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API: List Debt
app.get('/api/debt', async (req: Request, res: Response) => {
  try {
    const { namespace, zone } = req.query;

    if (!namespace) {
      return res.status(400).json({ error: 'namespace parameter is required' });
    }

    const client = getK8sClientByZone(zone as string);
    const originalClient = (global as any).kubernetesClient;
    (global as any).kubernetesClient = client;

    const result = await listDebtByNamespace({ namespace: namespace as string });

    (global as any).kubernetesClient = originalClient;
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API: List ObjectStorageBucket
app.get('/api/objectstoragebucket', async (req: Request, res: Response) => {
  try {
    const { namespace, zone } = req.query;

    if (!namespace) {
      return res.status(400).json({ error: 'namespace parameter is required' });
    }

    const client = getK8sClientByZone(zone as string);
    const originalClient = (global as any).kubernetesClient;
    (global as any).kubernetesClient = client;

    const result = await listObjectStorageBucketByNamespace({ namespace: namespace as string });

    (global as any).kubernetesClient = originalClient;
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API: List Certificate
app.get('/api/certificate', async (req: Request, res: Response) => {
  try {
    const { namespace, zone } = req.query;

    if (!namespace) {
      return res.status(400).json({ error: 'namespace parameter is required' });
    }

    const client = getK8sClientByZone(zone as string);
    const originalClient = (global as any).kubernetesClient;
    (global as any).kubernetesClient = client;

    const result = await listCertificateByNamespace({ namespace: namespace as string });

    (global as any).kubernetesClient = originalClient;
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// API 端点：检查资源详情（POST 请求，body 传参）
// ============================================================================

// 6) Inspect 端点（POST）→ 唯一的 POST 端点，使用 body 传参
//    为什么要用 POST：参数较多（resource/name/namespace/lines/zone），不适合放 URL
app.post('/api/inspect', async (req: Request, res: Response) => {
  try {
    // 翻译：const { resource, name, namespace, lines, zone } = req.body
    //     从请求 body 中解构出多个字段，lines 是可选的
    const { resource, name, namespace, lines, zone } = req.body;

    if (!resource || !name || !namespace) {
      return res.status(400).json({
        error: 'resource, name, and namespace are required'
      });
    }

    const client = getK8sClientByZone(zone);
    const originalClient = (global as any).kubernetesClient;
    (global as any).kubernetesClient = client;

    const result = await inspectResource({
      resource,
      name,
      namespace,
      lines: lines || 30
    });

    (global as any).kubernetesClient = originalClient;
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// API 文档端点
// ============================================================================

// 7) API 文档端点 → 返回所有可用端点的说明，方便开发者查看
//    为什么要提供：开发者可以通过访问 /api 快速了解所有可用接口
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    version: '2.6.0',
    description: 'Sealos SRE Agent HTTP API',
    zones: Object.keys(ZONE_KUBECONFIG_MAP),
    endpoints: {
      health: 'GET /health?zone=<zone>',
      none: 'GET /api/none?zone=<zone>&namespace=<ns> (always returns "空")',
      pods: 'GET /api/pods?zone=<zone>&namespace=<ns>',
      devbox: 'GET /api/devbox?zone=<zone>&namespace=<ns>',
      cluster: 'GET /api/cluster?zone=<zone>&namespace=<ns>',
      quota: 'GET /api/quota?zone=<zone>&namespace=<ns>',
      ingress: 'GET /api/ingress?zone=<zone>&namespace=<ns>',
      nodes: 'GET /api/nodes?zone=<zone>',
      cronjobs: 'GET /api/cronjobs?zone=<zone>&namespace=<ns>',
      events: 'GET /api/events?zone=<zone>&namespace=<ns>',
      account: 'GET /api/account?zone=<zone>&namespace=<ns>',
      debt: 'GET /api/debt?zone=<zone>&namespace=<ns>',
      objectstoragebucket: 'GET /api/objectstoragebucket?zone=<zone>&namespace=<ns>',
      certificate: 'GET /api/certificate?zone=<zone>&namespace=<ns>',
      inspect: 'POST /api/inspect (body: {zone, resource, name, namespace, lines?})'
    },
    examples: {
      none: 'curl "http://localhost:3000/api/none?zone=hzh&namespace=default"',
      listPods: 'curl "http://localhost:3000/api/pods?zone=hzh&namespace=default"',
      listDevbox: 'curl "http://localhost:3000/api/devbox?zone=gzg&namespace=default"',
      inspect: 'curl -X POST http://localhost:3000/api/inspect -H "Content-Type: application/json" -d \'{"zone":"hzh","resource":"pod","name":"my-pod","namespace":"default"}\''
    }
  });
});

// ============================================================================
// 启动服务器
// ============================================================================

/**
 * 【用途】启动 Express HTTP 服务器
 * 【核心流程】
 *   1) 输出初始化日志
 *   2) 调用 app.listen() 监听端口
 *   3) 输出启动成功日志
 * 【错误与边界】
 *   - 端口被占用会抛出 EADDRINUSE 错误（被第 549 行捕获）
 *   - 启动失败会以非 0 退出码退出进程
 */
async function startServer() {
  console.error('[HTTP Server] Initializing Sealos SRE Agent HTTP Service...');
  console.error('[HTTP Server] Available zones:', Object.keys(ZONE_KUBECONFIG_MAP).join(', '));

  // 翻译：app.listen(PORT, callback) - 监听指定端口，服务器就绪后调用回调
  //     这是个异步操作，但 Express 不返回 Promise，所以不能用 await
  app.listen(PORT, () => {
    console.error(`[HTTP Server] Server is running on http://localhost:${PORT}`);
    console.error(`[HTTP Server] API documentation: http://localhost:${PORT}/api`);
    console.error(`[HTTP Server] Health check: http://localhost:${PORT}/health`);
    console.error('[HTTP Server] Ready to accept requests');
  });
}

// 8) 启动 server 并捕获错误 → 防止进程静默退出
//    为什么要用 .catch()：app.listen 内部错误（如端口被占用）会抛出异常
startServer().catch((error) => {
  console.error('[HTTP Server] Fatal error:', error);
  process.exit(1);
});

/*
 ============================================================================
 额外输出：学习路径与改动指南
 ============================================================================
 我最该从哪 4 个代码块开始读？
 1) 第 106-120 行（getK8sClientByZone）：理解 zone 如何映射到 kubeconfig
 2) 第 128-147 行（/health 端点）：理解最简单的 API 端点结构
 3) 第 159-184 行（/api/pods 端点）：理解完整的 API 端点模式（切换客户端）
 4) 第 452-482 行（/api/inspect 端点）：理解 POST 端点如何从 body 读取参数

 我想改 A/B/C/D 功能，各自最可能改哪一段 + 风险点 + 如何验证？

 A) 新增一个 "/api/services" 端点
    → 改动点：
       1) 第 6-18 行：添加导入
          import { listServicesByNamespace } from './tools/list-services-by-ns';
       2) 复制第 159-184 行的模式，修改为：
          app.get('/api/services', async (req: Request, res: Response) => {
            try {
              const { namespace, zone } = req.query;
              if (!namespace) {
                return res.status(400).json({ error: 'namespace parameter is required' });
              }
              const client = getK8sClientByZone(zone as string);
              const originalClient = (global as any).kubernetesClient;
              (global as any).kubernetesClient = client;
              const result = await listServicesByNamespace({ namespace: namespace as string });
              (global as any).kubernetesClient = originalClient;
              res.json(result);
            } catch (error) {
              res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          });
       3) 第 490-517 行（API 文档）：添加 services 端点说明
    → 风险点：
       - 必须在 try/catch 中调用，否则未捕获异常会导致 server 崩溃
       - 必须恢复原客户端，否则影响后续请求
    → 验证：
       - curl "http://localhost:3000/api/services?zone=default&namespace=kube-system"
       - 检查返回的 JSON 是否包含 services 列表

 B) 修改默认端口（从 3000 改为 8080）
    → 改动点：第 21 行
       const PORT = process.env.PORT || 8080;
    → 风险点：
       - 需要更新防火墙规则、文档中的端口引用
       - 如果端口被占用，server 会启动失败
    → 验证：
       - 启动 server，确认日志显示 "Server is running on http://localhost:8080"
       - curl 测试新端口的健康检查

 C) 添加 API Key 认证（只有提供有效 API Key 才能访问）
    → 改动点：在第 24 行后添加认证中间件
       app.use((req, res, next) => {
         const apiKey = req.headers['x-api-key'] as string;
         const validApiKey = process.env.API_KEY;
         if (!validApiKey) {
           // 未配置 API_KEY，跳过认证
           return next();
         }
         if (apiKey !== validApiKey) {
           return res.status(401).json({ error: 'Invalid API key' });
         }
         next();
       });
    → 风险点：
       - 认证失败会拒绝所有请求，必须确保 validApiKey 正确
       - /api 和 /health 端点也会受影响（可能需要添加白名单）
    → 验证：
       - 不传 API Key，确认返回 401
       - 传正确的 API Key，确认返回正常数据

 D) 修复 global.kubernetesClient 的 hack（改用依赖注入）
    → 改动点：
       1) 修改工具函数签名，接受 client 参数（如 listPodsByNamespace(client, { namespace })）
       2) 修改所有工具实现文件，从参数获取 client 而不是从 global
       3) 修改 API 端点，直接传递 client 而不是修改 global
       示例：
         const result = await listPodsByNamespace(client, { namespace: namespace as string });
    → 风险点：
       - 需要修改所有工具函数签名和实现（影响 13+ 个文件）
       - MCP server (index.ts) 也需要修改（它也使用相同的工具函数）
    → 验证：
       - 运行 HTTP server，调用各个端点，确认返回正确数据
       - 运行 MCP server，调用各个工具，确认返回正确数据

 ============================================================================
*/
