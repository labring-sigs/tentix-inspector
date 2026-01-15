import { ListDevboxByNsInput, ListDevboxByNsInputSchema } from './types'; // 从同目录的 types 模块导入：输入类型（TS 类型）与输入校验 Schema（通常是 zod/yup 之类的运行时校验）
import { kubernetesClient } from '../kubernetes/client'; // 从 server/kubernetes/client 导入封装的 Kubernetes 客户端：用于获取 API 实例并与集群通信

export async function listDevboxByNamespace(input: ListDevboxByNsInput) { // 导出一个异步函数：根据传入的 input（包含 namespace 等）列出该命名空间下的 Devbox 自定义资源
  const validatedInput = ListDevboxByNsInputSchema.parse(input); // 使用 Schema 对 input 做运行时校验 + 解析：确保字段存在、类型正确（校验失败会直接抛异常）
  const { namespace } = validatedInput; // 从校验后的输入中解构出 namespace：后续所有查询都围绕这个 namespace 进行

  console.error(`[Server] Executing: kubectl get devbox -n ${namespace}`); // 打印一条“等价 kubectl 命令”的日志到 stderr：用于让你在日志里直观看到正在做什么（并不真的执行 kubectl）

  try { // try 块：包裹真正的 Kubernetes API 调用和结果处理逻辑，便于统一捕获异常
    const customObjectsApi = kubernetesClient.getCustomObjectsApi(); // 从 kubernetesClient 获取 CustomObjectsApi：这是访问 CRD（自定义资源）的标准 API 客户端

    const response = await customObjectsApi.listNamespacedCustomObject( // 调用 Kubernetes CustomObjects API：列出某个 namespace 下某个 G/V/Plural 的自定义对象列表
      'devbox.sealos.io',  // group：CRD 的 API Group（对应 apis/<group>/<version> 路径中的 group）
      'v1alpha2',          // version：CRD 的版本（例如 v1alpha1/v1alpha2 等）
      namespace,           // namespace：限定查询在某个命名空间内（namespaced 资源才会有这个参数）
      'devboxes'           // plural：资源的复数名（通常是 kind 的小写复数，kubectl get <plural>）
    ); // 结束 listNamespacedCustomObject：得到 response，其中 response.body 通常含 items 数组

    // Extract and transform devbox data // 注释：下面开始“抽取并转换” Devbox 列表数据，构造成对外返回更友好的结构
    const devboxes = (response.body as any).items?.map((item: any) => ({ // 从 response.body.items 取出每个资源对象并 map 成简化结构；这里把 body 和 item 都当 any 处理（避免类型过于严格）
      name: item.metadata?.name || 'unknown', // 取资源名：优先 item.metadata.name；如果不存在则兜底 'unknown'（避免返回 undefined）
      status: item.status?.phase || item.status?.state || 'Unknown', // 取状态：优先 phase，其次 state（两种字段兼容不同 CRD/不同 controller 的写法），都没有则 'Unknown'
      network: item.status?.network || {}, // 取网络信息：从 status.network 获取；没有则返回空对象，保证字段存在便于前端/调用方处理
    })) || []; // 如果 items 不存在（例如 API 返回结构异常/无 items 字段），则 devboxes 兜底为空数组

    return { // 返回成功响应对象：会被 index.ts 中 JSON.stringify 后以 text 形式返回给 MCP 调用方
      namespace, // 回传 namespace：让调用方知道这是哪个命名空间的数据（即使后续聚合也更好用）
      devboxes, // devboxes 列表：上面抽取出来的简化数据数组
      total: devboxes.length, // total：列表长度，方便调用方直接展示/统计
      success: true, // success：显式标记此次调用成功（便于调用方统一判断）
    }; // 结束成功返回
  } catch (error: any) { // catch 块：捕获 try 中任何异常；这里把 error 标为 any，便于访问 response/body/message 等非标准字段
    console.error(`[Server] Error listing devboxes in namespace ${namespace}:`, error); // 输出错误日志到 stderr：包含命名空间和 error 详情，便于排查

    // Extract meaningful error information // 注释：下面开始从 error 中提取更“可读/有意义”的错误信息，返回给调用方
    let errorMessage = 'Unknown error occurred'; // 默认错误文案：当无法从 error 中提取信息时使用，保证一定有 message
    if (error.response && error.response.body && error.response.body.message) { // 判断：如果是典型的 HTTP/Client 错误结构（例如 Kubernetes client 抛出的带 response.body.message）
      errorMessage = error.response.body.message; // 优先使用 response.body.message：这通常是 Kubernetes API 返回的具体错误（权限不足、资源不存在等）
    } else if (error.message) { // 否则：如果 error 本身有 message 字段（标准 Error 对象）
      errorMessage = error.message; // 使用 error.message：例如网络错误、解析错误、Schema 抛错等
    } // 结束错误信息提取逻辑：errorMessage 至此一定是一个字符串

    return { // 返回失败响应对象：仍然保持固定字段结构，便于调用方统一处理
      namespace, // 回传 namespace：让调用方知道在哪个命名空间查询失败
      devboxes: [], // 失败时 devboxes 置空：避免调用方误用旧数据，同时结构稳定
      total: 0, // total 为 0：与 devboxes 空数组保持一致
      error: errorMessage, // error 字段：把提取到的错误信息返回给调用方（index.ts 会 stringify 输出）
      success: false, // success：显式标记失败（便于调用方快速判断分支）
    }; // 结束失败返回
  } // 结束 try/catch：函数完成一次“查询并返回”或“失败并返回错误”
} // 结束函数定义