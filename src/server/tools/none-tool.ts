export async function returnNoneResult(): Promise<string> {
  console.error('[Server] Executing: none (no cluster query needed)');
  return 'AI认为当前不需要返回用户集群数据';
}
