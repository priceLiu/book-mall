const locks = new Map<string, Promise<unknown>>();

/** 同一爆款复刻项目的 output 写库串行化，避免并行完成时互相覆盖。 */
export function withMainImageHitReplicaOutputLock<T>(
  projectId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = locks.get(projectId) ?? Promise.resolve();
  const next = prev.then(() => fn(), () => fn());
  locks.set(
    projectId,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  void next.finally(() => {
    if (locks.get(projectId) === next) locks.delete(projectId);
  });
  return next;
}