import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  LIST_PODS_BY_NS_TOOL,
  LIST_DEVBOX_BY_NS_TOOL,
  LIST_CLUSTER_BY_NS_TOOL,
  LIST_QUOTA_BY_NS_TOOL,
  LIST_INGRESS_BY_NS_TOOL,
  LIST_NODES_TOOL,
  LIST_CRONJOBS_BY_NS_TOOL,
  LIST_EVENTS_BY_NS_TOOL,
  LIST_ACCOUNT_BY_NS_TOOL,
  LIST_DEBT_BY_NS_TOOL,
  LIST_OBJECTSTORAGEBUCKET_BY_NS_TOOL,
  LIST_CERTIFICATE_BY_NS_TOOL,
  INSPECT_RESOURCE_TOOL,
} from './tools/types';

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
import { kubernetesClient } from './kubernetes/client';

/*
 ============================================================================
 快速上手区
 ============================================================================
 这个文件解决什么问题？
   这是 MCP (Model Context Protocol) server 的主入口文件。
   负责：
   1) 初始化 Kubernetes 客户端连接
   2) 创建 MCP Server 实例并注册工具
   3) 监听来自宿主（Claude/ChatGPT）的请求并分发到对应工具实现
   4) 将工具结果格式化为 MCP 协议响应返回

 核心入口函数：
   main() (第 106 行)：异步主函数，执行完整的服务器启动流程

 关键数据对象：
   1) server (Server 实例)：MCP 服务器对象，负责注册 handler、处理请求
      → 来自 @modelcontextprotocol/sdk/server/index.js
   2) LIST_*_TOOL 常量：工具定义对象（name/description/inputSchema）
      → 来自 ./tools/types，用于 ListTools 响应
   3) list* 函数：工具实现函数，实际调用 Kubernetes API
      → 来自 ./tools/list-*.ts，在 CallTool handler 中被调用

 主要副作用：
   - 网络：初始化时连接 Kubernetes 集群（testConnection）
   - I/O：通过 stdin/stdout 与宿主通信（StdioServerTransport）
   - 全局状态：创建 server 实例并注册 handler
   - 日志：向 stderr 输出运行时日志（不干扰 stdout 协议通信）

 改动导航：
   1) 想新增一个 Kubernetes 资源查询工具？
      → 优先看：第 8-21 行（导入 *_TOOL 定义）、第 24-36 行（导入 list* 实现）
      → 需要同步修改：
         - 在第 8-21 行添加工具定义导入
         - 在第 24-36 行添加工具实现导入
         - 在第 152-167 行（tools 数组）添加工具定义
         - 在第 184-331 行（switch case）添加分发逻辑
      → 验证：调用新工具，确认返回预期数据
   2) 想修改服务器名称或版本？
      → 优先看：第 133-135 行（new Server 的第一个参数）
      → 风险点：宿主侧可能缓存了服务器信息，需要重启 MCP 服务
      → 验证：在宿主侧查看服务器名称是否更新
   3) 想修改错误处理逻辑（如返回更详细的错误信息）？
      → 优先看：第 338-355 行（catch 块）
      → 风险点：返回的错误信息可能暴露敏感信息（如集群地址）
      → 验证：触发一个错误（如传无效参数），检查返回的错误内容
   4) 想添加启动时的健康检查（如检查特定资源是否存在）？
      → 优先看：第 113-124 行（连接测试后的逻辑）
      → 风险点：健康检查失败可能导致 server 无法启动
      → 验证：故意制造健康检查失败，确认 server 是否正常启动
 ============================================================================
*/

/**
 * 【用途】MCP server 主入口函数：初始化客户端、创建 server、注册 handlers、启动服务
 * 【上游/下游】被第 378 行调用 → 内部调用 kubernetesClient 和各种 list* 工具函数
 * 【核心流程】
 *   1) 测试 Kubernetes 连接（第 113-124 行）
 *   2) 创建 MCP Server 实例（第 132-142 行）
 *   3) 注册 ListTools handler（第 150-168 行）：返回工具列表
 *   4) 注册 CallTool handler（第 176-356 行）：分发并执行工具
 *   5) 启动 server 并连接 stdio transport（第 366-369 行）
 * 【错误与边界】
 *   - 连接失败仅警告，不中断启动（第 118-120 行）
 *   - 未知工具调用抛出错误（第 336 行）
 *   - main 内部未捕获异常会导致进程退出（第 378 行）
 */
async function main() {
  // ============================================================================
  // 阶段 1：初始化 Kubernetes 客户端
  // ============================================================================

  // 1) 测试 Kubernetes 连接 → 验证 kubeconfig 是否有效、能否访问集群
  //    为什么要测试：避免 server 启动后才发现无法连接，提前暴露问题
  console.error('[Server] Initializing Kubernetes client...');
  const isConnected = await kubernetesClient.testConnection();

  // 2) 根据连接结果输出不同日志 → 帮助排查连接到哪个集群
  //    为什么要区分：连接失败时只警告，不中断启动（可能在某些场景下仍可工作）
  if (!isConnected) {
    console.error('[Server] Warning: Failed to connect to Kubernetes cluster');
  } else {
    // 翻译：?. 可选链访问，如果 context 为 undefined 则返回 undefined 而不报错
    const context = kubernetesClient.getCurrentContext();
    console.error(`[Server] Connected to cluster: ${context?.cluster}`);
  }

  // ============================================================================
  // 阶段 2：创建 MCP Server 实例
  // ============================================================================

  // 3) 创建 Server 实例 → 这是 MCP 协议的核心对象，负责注册 handlers
  //    为什么要传 name/version：宿主侧用它识别和显示 server 信息
  const server = new Server(
    {
      name: 'sealos-sre-agent-server',
      version: '2.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // ============================================================================
  // 阶段 3：注册 ListTools handler（返回可用工具列表）
  // ============================================================================

  // 4) 注册 ListTools handler → 宿主启动时会调用此 handler 获取工具列表
  //    为什么要返回工具定义：让宿主知道有哪些工具可用、每个工具需要什么参数
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        LIST_PODS_BY_NS_TOOL,
        LIST_DEVBOX_BY_NS_TOOL,
        LIST_CLUSTER_BY_NS_TOOL,
        LIST_QUOTA_BY_NS_TOOL,
        LIST_INGRESS_BY_NS_TOOL,
        LIST_NODES_TOOL,
        LIST_CRONJOBS_BY_NS_TOOL,
        LIST_EVENTS_BY_NS_TOOL,
        LIST_ACCOUNT_BY_NS_TOOL,
        LIST_DEBT_BY_NS_TOOL,
        LIST_OBJECTSTORAGEBUCKET_BY_NS_TOOL,
        LIST_CERTIFICATE_BY_NS_TOOL,
        INSPECT_RESOURCE_TOOL,
      ],
    };
  });

  // ============================================================================
  // 阶段 4：注册 CallTool handler（分发并执行工具调用）
  // ============================================================================

  // 5) 注册 CallTool handler → 宿主调用工具时会执行此 handler
  //    核心逻辑：从 request.params 解构出 name 和 args，按 name 分发到不同实现
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // 翻译：const { name, arguments: args } 解构赋值 + 重命名
    //     从 request.params 中取出 name 和 arguments，将 arguments 重命名为 args（避免与 JS 关键字冲突）
    const { name, arguments: args } = request.params;

    try {
      // 6) switch 分发 → 根据工具名调用对应的实现函数
      //    为什么要用 switch：每个工具的调用逻辑相同（调用实现 → 格式化返回），但函数名不同
      switch (name) {
        case 'list_pods_by_ns':
          // 翻译：args as any - 类型断言，将 args 强制转为 any 类型
          //     为什么要断言：工具实现函数期望特定类型（如 ListPodsByNsInput），
          //               而 args 的类型是 unknown，直接传会报类型错误
          const result = await listPodsByNamespace(args as any);
          return {
            content: [
              {
                type: 'text',
                // 翻译：JSON.stringify(value, null, 2) - 将对象转为格式化的 JSON 字符串
                //     第 2 个参数 null 表示不替换任何值，第 3 个参数 2 表示缩进 2 空格
                text: JSON.stringify(result, null, 2),
              },
            ],
          };

        case 'list_devbox_by_ns':
          const devboxResult = await listDevboxByNamespace(args as any);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(devboxResult, null, 2),
              },
            ],
          };

        case 'list_cluster_by_ns':
          const clusterResult = await listClusterByNamespace(args as any);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(clusterResult, null, 2),
              },
            ],
          };

        case 'list_quota_by_ns':
          const quotaResult = await listQuotaByNamespace(args as any);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(quotaResult, null, 2),
              },
            ],
          };

        case 'list_ingress_by_ns':
          const ingressResult = await listIngressByNamespace(args as any);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(ingressResult, null, 2),
              },
            ],
          };

        case 'list_nodes':
          const nodesResult = await listNodes(args as any);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(nodesResult, null, 2),
              },
            ],
          };

        case 'list_cronjobs_by_ns':
          const cronjobsResult = await listCronjobsByNamespace(args as any);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(cronjobsResult, null, 2),
              },
            ],
          };

        case 'list_events_by_ns':
          const eventsResult = await listEventsByNamespace(args as any);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(eventsResult, null, 2),
              },
            ],
          };

        case 'list_account_by_ns':
          const accountResult = await listAccountByNamespace(args as any);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(accountResult, null, 2),
              },
            ],
          };

        case 'list_debt_by_ns':
          const debtResult = await listDebtByNamespace(args as any);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(debtResult, null, 2),
              },
            ],
          };

        case 'list_objectstoragebucket_by_ns':
          const objectstoragebucketResult = await listObjectStorageBucketByNamespace(args as any);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(objectstoragebucketResult, null, 2),
              },
            ],
          };

        case 'list_certificate_by_ns':
          const certificateResult = await listCertificateByNamespace(args as any);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(certificateResult, null, 2),
              },
            ],
          };

        case 'inspect_resource':
          const inspectResult = await inspectResource(args as any);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(inspectResult, null, 2),
              },
            ],
          };

        default:
          // 7) 未知工具处理 → 抛出错误，让 catch 捕获并返回 MCP 错误响应
          //    为什么要抛出：不应该到达这里（宿主只会调用 ListTools 返回的工具）
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      // 8) 统一错误处理 → 捕获任何工具执行异常，返回 MCP 格式的错误响应
      //    为什么要捕获：避免单个工具错误导致整个 server 崩溃
      console.error(`[Server] Error executing tool ${name}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              // 翻译：error instanceof Error ? error.message : 'Unknown error'
              //     类型守卫 + 三元表达式：判断 error 是否是 Error 实例，是则取 message，否则返回通用字符串
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  });

  // ============================================================================
  // 阶段 5：启动 server（连接 stdio transport）
  // ============================================================================

  // 9) 创建 stdio transport 并连接 → MCP 通过 stdin/stdout 与宿主通信
  //    为什么要用 stdio：MCP 协议的标准传输方式（子进程与父进程通信）
  const transport = new StdioServerTransport();
  console.error('[Server] Starting MCP server...');
  await server.connect(transport);
  console.error('[Server] MCP server started and listening');
  // 翻译：await server.connect(transport) 会一直阻塞，保持进程运行
  //     server 启动后会持续监听 stdin，收到请求后调用对应的 handler
}

// ============================================================================
// 启动入口
// ============================================================================

// 10) 调用 main 并捕获未处理异常 → 防止进程静默退出
//    为什么要用 .catch()：main 内部的 await 如果抛出未捕获异常，进程会以状态码 0 退出（误导调用方）
main().catch((error) => {
  console.error('[Server] Fatal error:', error);
  // 翻译：process.exit(1) 以非 0 退出码退出进程
  //     退出码 0 表示成功，非 0 表示失败，告诉宿主/系统这次启动失败
  process.exit(1);
});

/*
 ============================================================================
 额外输出：学习路径与改动指南
 ============================================================================
 我最该从哪 4 个代码块开始读？
 1) 第 176-356 行（CallTool handler）：理解工具调用的核心分发逻辑
 2) 第 184-331 行（switch case）：理解每个工具的调用模式（相同结构，不同函数）
 3) 第 150-168 行（ListTools handler）：理解工具列表如何暴露给宿主
 4) 第 132-142 行（new Server）：理解 MCP Server 的初始化结构

 我想改 A/B/C/D 功能，各自最可能改哪一段 + 风险点 + 如何验证？

 A) 新增一个 "list_services_by_ns" 工具
    → 改动点：
       1) 第 8-21 行：添加导入
          import { LIST_SERVICES_BY_NS_TOOL } from './tools/types';
          import { listServicesByNamespace } from './tools/list-services-by-ns';
       2) 第 152-167 行（tools 数组）：添加 LIST_SERVICES_BY_NS_TOOL
       3) 第 184-331 行（switch case）：添加 case 'list_services_by_ns'
    → 风险点：
       - 必须同时修改 3 处（导入、注册、分发），否则会报错或工具不可用
       - case 里的 name 必须与 LIST_SERVICES_BY_NS_TOOL.name 完全一致
    → 验证：
       - 运行 `npx ts-node` 检查类型错误
       - 启动 server，在宿主侧查看工具列表是否包含新工具
       - 调用新工具，确认返回预期数据

 B) 修改服务器版本号（如从 2.0.0 改为 2.1.0）
    → 改动点：第 135 行（version: '2.0.0'）
    → 风险点：
       - 宿主侧可能缓存了服务器信息，需要重启 MCP 服务才能看到更新
       - 如果有其他系统依赖版本号，可能导致兼容性问题
    → 验证：
       - 启动 server，在宿主侧查看服务器版本是否更新
       - 检查宿主侧的 MCP server 列表

 C) 添加请求日志（记录每次工具调用的参数和结果）
    → 改动点：第 176-356 行（CallTool handler）
       - 在 switch 之前添加：console.error('[Server] Tool called:', name, args);
       - 在每个 case return 之前添加：console.error('[Server] Tool result:', result);
    → 风险点：
       - 日志可能暴露敏感信息（如 namespace、资源名称）
       - 大量日志可能影响性能
    → 验证：
       - 调用一个工具，检查 stderr 输出是否包含日志
       - 确认日志格式可读且不暴露敏感信息

 D) 修改错误返回格式（如增加错误码、堆栈信息）
    → 改动点：第 338-355 行（catch 块）
       return {
         content: [{
           type: 'text',
           text: JSON.stringify({
             error: error instanceof Error ? error.message : 'Unknown error',
             code: error instanceof Error && 'code' in error ? error.code : 'UNKNOWN',
             // 堆栈信息仅在开发环境返回
             stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
           }),
         }],
         isError: true,
       };
    → 风险点：
       - 堆栈信息可能暴露代码结构、文件路径等敏感信息
       - 宿主侧可能不识别新的错误格式
    → 验证：
       - 触发一个错误（如传无效参数），检查返回的错误内容
       - 确认宿主侧能正确解析新的错误格式
 ============================================================================
*/
