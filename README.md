# Sealos SRE Agent

这是一个 Node/TypeScript 写的小型 SRE Agent，用于在指定 Kubernetes 集群/namespace 上执行查询类操作。

核心能力：

- 通过本地 `kubeconfig/` 连接到不同集群（按 `zone` 选择 kubeconfig）
- 使用 LLM 根据工单/上下文自动选择最合适的“工具”(tool)
- 执行对应的 Kubernetes 查询，并返回结构化 JSON

当前主要支持的运行方式是 HTTP 服务（`POST /api/skills`）。

## 目录与文件作用

- `src/server/http-server.ts`
  - HTTP 入口（Express）。
  - 对外提供 `POST /api/skills`，把请求交给 Agent 执行并返回结果。

- `src/server/agent/graph.ts`
  - Agent 工作流（LangGraph）：`init -> router(LLM) -> executor`。
  - 负责：加载 `.env`、按 `zone` 选择 kubeconfig、调用 LLM 决策 tool、执行 tool。

- `src/server/kubernetes/client.ts`
  - 基于 `@kubernetes/client-node` 的简单封装（CoreV1/CustomObjects/Ingress/CronJob 等）。

- `src/server/tools/*.ts`
  - 各类 tool 的具体实现（list pods/devbox/cluster/quota/ingress/events...）。

- `kubeconfig/`
  - 存放 kubeconfig（敏感文件，不应提交到 git）。

- `dist/`
  - `tsc` 的编译产物。

说明：`src/server/index.ts` 是一个 MCP(stdio) server 入口，但目前被 `tsconfig.json` 排除了（默认 `npm run build` 不会产出对应的 `dist/server/index.js`）。

## 前置条件

- Node.js >= 18
- 可用的 kubeconfig（能访问对应集群）
- 一个 OpenAI-compatible 的 LLM 接口地址 + API Key

## 配置

### 1) 新建 `.env`

需要的环境变量：

```bash
# 必填
AI_API_KEY=...
AI_BASE_URL=https://your-openai-compatible-endpoint

# 可选（默认：gemini-1.5-flash）
AI_MODEL=gemini-1.5-flash

# 可选 HTTP 端口（默认：3000）
PORT=3000
```

`AI_BASE_URL` 会被自动规范化为以 `/v1` 结尾。

### 2) 准备 `kubeconfig/`

`zone` 与 kubeconfig 文件名的映射在 `src/server/agent/graph.ts` 里：

- `hzh` -> `kubeconfig/hzh-kubeconfig`
- `bja` -> `kubeconfig/bja-kubeconfig`
- `gzg` -> `kubeconfig/gzg-kubeconfig`
- `default` -> `kubeconfig/Mykubeconfig`(test)

## 如何运行

安装依赖：

```bash
npm install
```
### 生产模式（编译 + 运行）

```bash
npm run build
npm run start:http
```

### 开发模式（ts-node）

```bash
npm run dev:http
```

默认监听：`http://localhost:3000`（或 `PORT` 指定的端口）。

说明：`npm run start:client` / `npm run dev:client` 目前仓库未包含 `src/client`，默认会运行失败。

## HTTP API

### `POST /api/skills`

- Query 参数：
  - `zone`：可选，默认 `default`
  - `namespace`：必填（如果 body 里没传）
- JSON body（除 `namespace` 规则外，均可选）：
  - `zone`
  - `namespace`
  - `ticketTitle`
  - `ticketModule`
  - `ticketDescription`
  - `historyMessages`
  - `latestMessage`
  - `latestMessageImages`（string 数组）

示例：

```bash
curl -sS -X POST 'http://localhost:3000/api/skills?zone=hzh&namespace=default' \
  -H 'content-type: application/json' \
  -d '{
    "ticketTitle": "pod status check",
    "ticketDescription": "please list pods",
    "latestMessage": "check current pods in this namespace"
  }'
```

响应结构（示例）：

```json
{
  "tool": "list_pods_by_ns",
  "description": "List all pods in a specific namespace",
  "result": {
    "namespace": "default",
    "pods": [],
    "total": 0,
    "success": true
  }
}
```

## 已注册的 Tools（HTTP Agent）

HTTP Agent 侧注册列表以 `src/server/agent/graph.ts` 为准：

- `list_pods_by_ns`
- `list_devbox_by_ns`
- `list_cluster_by_ns`
- `list_quota_by_ns`
- `list_ingress_by_ns`
- `list_cronjobs_by_ns`
- `list_events_by_ns`
- `list_account_by_ns`
- `list_debt_by_ns`
- `list_objectstoragebucket_by_ns`
- `list_certificate_by_ns`

## 常见问题

- LLM 返回内容解析失败时，会降级执行 `list_pods_by_ns`。
- Kubernetes 请求失败时，优先检查：`zone` 是否正确、对应 kubeconfig 是否存在且有权限。
- `.env` 和 `kubeconfig/` 是敏感信息，仓库默认忽略它们是预期行为。
