/**
 * 同一项目 + 同一步骤的出图 HTTP 串行化，避免多批并发时 resetStepStatus / plan 互相覆盖。
 * （单进程有效；多副本部署时仍依赖 patch 槽位 merge + finalize 只改 status。）
 */

const chains = new Map<string, Promise<void>>();

export async function withEcomIpWorkflowStepGenerationLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  chains.set(
    key,
    prev.then(() => gate),
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (chains.get(key) === gate) chains.delete(key);
  }
}
