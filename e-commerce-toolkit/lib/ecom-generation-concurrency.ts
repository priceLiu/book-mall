/** 与 book-mall `ecom-image-gen-concurrency.ts` 标准默认一致 */
export const ECOM_GENERATION_STANDARD_CONCURRENCY = 2;

export function normalizeEcomGenerationConcurrencyLimit(
  value: unknown,
  fallback = ECOM_GENERATION_STANDARD_CONCURRENCY,
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.max(1, Math.round(n));
}

/**
 * 有限并发执行 async 任务，返回与 Promise.allSettled 相同结构的逐项结果。
 */
export async function mapWithConcurrencySettled<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.round(concurrency));
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let idx = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      try {
        const value = await fn(items[i]!);
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}
