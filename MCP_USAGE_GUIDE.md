# MCP 工具调用指南 - 如何在 Claude 中提问

## 📋 可用工具列表

你的 MCP 服务器提供了以下 13 个工具：

### 列表查询工具（需要 namespace）
1. **list_pods_by_ns** - 列出命名空间中的所有 Pods
2. **list_devbox_by_ns** - 列出命名空间中的所有 Devboxes
3. **list_cluster_by_ns** - 列出命名空间中的 KubeBlocks 集群（数据库）
4. **list_quota_by_ns** - 列出命名空间中的资源配额
5. **list_ingress_by_ns** - 列出命名空间中的 Ingress 资源
6. **list_cronjobs_by_ns** - 列出命名空间中的 CronJob 资源
7. **list_events_by_ns** - 列出命名空间中的事件（最近 100 条，按时间排序）
8. **list_account_by_ns** - 列出命名空间中的 Account CRD 资源
9. **list_debt_by_ns** - 列出命名空间中的 Debt CRD 资源
10. **list_objectstoragebucket_by_ns** - 列出命名空间中的对象存储桶
11. **list_certificate_by_ns** - 列出命名空间中的证书资源

### 集群级别工具
12. **list_nodes** - 列出集群中的所有节点（namespace 参数会被忽略）

### 资源检查工具
13. **inspect_resource** - 检查指定资源的详细信息（包括 manifest、事件、日志等）

---

## 🎯 提问方式示例

### 1. 查询 Pods

**简单提问：**
```
列出 default 命名空间中的所有 pods
```

**更具体的提问：**
```
请帮我查看 hzh 命名空间下有哪些 pod，它们的状态如何？
```

**Claude 会自动调用：** `list_pods_by_ns` 工具，参数：`{ namespace: "hzh" }`

---

### 2. 查询 Devbox

**提问示例：**
```
显示 my-namespace 命名空间中的所有 devbox
```

```
hzh 命名空间里有哪些 devbox？它们的状态是什么？
```

**Claude 会自动调用：** `list_devbox_by_ns` 工具

---

### 3. 查询集群（数据库）

**提问示例：**
```
列出 production 命名空间中的所有 KubeBlocks 集群
```

```
查看 default 命名空间下有哪些数据库集群
```

**Claude 会自动调用：** `list_cluster_by_ns` 工具

---

### 4. 查询资源配额

**提问示例：**
```
检查 production 命名空间的资源配额情况
```

```
hzh 命名空间的配额限制是多少？
```

**Claude 会自动调用：** `list_quota_by_ns` 工具

---

### 5. 查询 Ingress

**提问示例：**
```
列出 default 命名空间中的所有 ingress 资源
```

```
查看 production 命名空间下有哪些 ingress 配置
```

**Claude 会自动调用：** `list_ingress_by_ns` 工具

---

### 6. 查询节点

**提问示例：**
```
列出集群中的所有节点
```

```
查看集群节点状态
```

**Claude 会自动调用：** `list_nodes` 工具（不需要 namespace）

---

### 7. 查询 CronJob

**提问示例：**
```
列出 default 命名空间中的所有 cronjob
```

```
查看 production 命名空间下有哪些定时任务
```

**Claude 会自动调用：** `list_cronjobs_by_ns` 工具

---

### 8. 查询事件

**提问示例：**
```
查看 hzh 命名空间中的最近事件
```

```
列出 default 命名空间下最近发生的事件
```

**Claude 会自动调用：** `list_events_by_ns` 工具

---

### 9. 查询账户和账单

**提问示例：**
```
列出 hzh 命名空间中的账户信息
```

```
查看 default 命名空间下的账单（debt）情况
```

**Claude 会自动调用：** `list_account_by_ns` 或 `list_debt_by_ns` 工具

---

### 10. 查询对象存储和证书

**提问示例：**
```
列出 production 命名空间中的所有对象存储桶
```

```
查看 default 命名空间下有哪些证书
```

**Claude 会自动调用：** `list_objectstoragebucket_by_ns` 或 `list_certificate_by_ns` 工具

---

### 11. 检查资源详情（inspect_resource）

这是最强大的工具，可以检查任何资源的详细信息，包括 manifest、事件和日志。

**提问示例：**

**检查 Pod：**
```
检查 default 命名空间中名为 my-pod 的 pod 详情
```

```
查看 hzh 命名空间下 nginx-pod 这个 pod 的日志和事件
```

```
检查 production 命名空间中 frontend-pod 的详细信息，包括最近 50 行日志
```

**Claude 会自动调用：** `inspect_resource` 工具，参数：
```json
{
  "resource": "pod",
  "name": "my-pod",
  "namespace": "default",
  "lines": 30  // 默认 30 行，可以指定更多
}
```

**检查其他资源：**
```
检查 default 命名空间中名为 my-service 的 service
```

```
查看 production 命名空间下 my-deployment 这个 deployment 的详细信息
```

```
检查 hzh 命名空间中名为 my-devbox 的 devbox 资源
```

**支持的资源类型：**
- 标准 K8s 资源：pod, deployment, service, configmap, secret, ingress, pv, pvc, statefulset, daemonset, job, cronjob, namespace, node, event, serviceaccount, role, rolebinding, clusterrole, clusterrolebinding, resourcequota, hpa
- Sealos CRD：devbox, cluster, account, debt, objectstoragebucket
- Cert-manager：certificate, issuer, clusterissuer

**注意：** 资源类型支持单数和复数形式（如 `pod` 或 `pods`）

---

## 💡 提问技巧

### ✅ 好的提问方式

1. **明确指定命名空间：**
   ```
   查看 hzh 命名空间中的所有 pods
   ```

2. **使用自然语言：**
   ```
   帮我看看 production 环境下的 ingress 配置
   ```

3. **组合查询：**
   ```
   先列出 default 命名空间的 pods，然后检查其中名为 nginx 的 pod 详情
   ```

4. **指定日志行数：**
   ```
   检查 my-pod 的最近 100 行日志
   ```

### ❌ 避免的提问方式

1. **不要只说工具名：**
   ```
   list_pods_by_ns  # ❌ Claude 需要自然语言理解
   ```

2. **不要忘记命名空间：**
   ```
   列出所有 pods  # ❌ 需要指定 namespace
   ```

3. **不要使用错误的资源类型：**
   ```
   检查 my-pod 的 deployment  # ❌ pod 不是 deployment
   ```

---

## 🔄 工作流程示例

### 示例 1：排查 Pod 问题

**第一步：列出 Pods**
```
列出 default 命名空间中的所有 pods
```

**第二步：检查有问题的 Pod**
```
检查 default 命名空间中名为 nginx-pod 的 pod，查看最近 100 行日志
```

**第三步：查看相关事件**
```
查看 default 命名空间中的最近事件
```

---

### 示例 2：检查集群资源

**第一步：查看节点**
```
列出集群中的所有节点
```

**第二步：查看资源配额**
```
检查 production 命名空间的资源配额
```

**第三步：查看 Devbox**
```
列出 production 命名空间中的所有 devbox
```

---

## 📝 注意事项

1. **命名空间是必需的**（除了 `list_nodes`）
   - 所有列表工具都需要指定 `namespace` 参数
   - 如果提问中没有明确命名空间，Claude 可能会询问你

2. **资源名称要准确**
   - `inspect_resource` 需要准确的资源名称
   - 如果名称不对，会返回错误

3. **日志行数限制**
   - `inspect_resource` 的 `lines` 参数默认是 30 行
   - 可以明确指定更多行数，如 "最近 100 行日志"

4. **Claude 会自动选择工具**
   - 你不需要记住工具名
   - 只需用自然语言描述需求
   - Claude 会根据你的描述自动选择合适的工具和参数

---

## 🚀 快速开始

试试这些提问：

1. **"列出 default 命名空间中的所有 pods"**
2. **"检查 default 命名空间中名为 nginx 的 pod 详情"**
3. **"查看集群中的所有节点"**
4. **"列出 hzh 命名空间中的所有 devbox"**

Claude 会自动识别你的意图并调用相应的 MCP 工具！



