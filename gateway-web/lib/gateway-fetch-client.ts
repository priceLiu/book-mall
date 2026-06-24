/** 浏览器端 fetch：超时 + 单飞，避免 dev 下 DB 阻塞导致请求堆叠、tab 一直 loading */

export async function fetchJsonWithTimeout<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const timeoutMs = init?.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as T | null;
    return { ok: res.ok, status: res.status, data };
  } finally {
    window.clearTimeout(timer);
  }
}

export function createSingleFlight<T extends (...args: never[]) => Promise<unknown>>(
  fn: T,
): T {
  let inFlight: Promise<unknown> | null = null;
  return ((...args: Parameters<T>) => {
    if (inFlight) return inFlight as ReturnType<T>;
    inFlight = fn(...args).finally(() => {
      inFlight = null;
    });
    return inFlight as ReturnType<T>;
  }) as T;
}
