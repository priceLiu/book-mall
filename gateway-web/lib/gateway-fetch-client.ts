/** 浏览器端 fetch：超时 + 单飞，避免 dev 下 DB 阻塞导致请求堆叠、tab 一直 loading */

export async function fetchJsonWithTimeout<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const timeoutMs = init?.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort(
      typeof DOMException !== "undefined"
        ? new DOMException("请求超时", "TimeoutError")
        : undefined,
    );
  }, timeoutMs);
  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as T | null;
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    const timedOut =
      (e instanceof DOMException &&
        (e.name === "AbortError" || e.name === "TimeoutError")) ||
      (e instanceof Error && e.name === "AbortError");
    if (timedOut) {
      return { ok: false, status: 408, data: null };
    }
    return { ok: false, status: 0, data: null };
  } finally {
    window.clearTimeout(timer);
  }
}

/** 同参数并发调用合并为一次 in-flight Promise */
export function createSingleFlight<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  let inFlight: Promise<R> | null = null;
  return (...args: A) => {
    if (inFlight) return inFlight;
    inFlight = fn(...args).finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
