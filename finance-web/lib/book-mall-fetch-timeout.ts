/** 浏览器经 BFF 拉 book-mall 会话时的默认超时（避免页面永久「校验权限中」） */
export const BOOK_MALL_VIEWER_FETCH_MS = 12_000;

export async function fetchWithOptionalTimeout(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const parentSignal = init?.signal;
  if (parentSignal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const timeoutAc = new AbortController();
  const onParentAbort = () => timeoutAc.abort();
  parentSignal?.addEventListener("abort", onParentAbort);
  const timer = setTimeout(() => timeoutAc.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: timeoutAc.signal });
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}

export function bookMallUnreachableMessage(base: string): string {
  return `无法在 ${timeoutMsLabel()} 内连接 Book 主站（${base}）。请确认 dev:all 中 book-mall 已启动、已在主站登录，且 finance-web 的 BOOK_MALL_URL 指向正确端口（本地一般为 http://localhost:3000）。`;
}

function timeoutMsLabel(): string {
  return `${BOOK_MALL_VIEWER_FETCH_MS / 1000} 秒`;
}

export { timeoutMsLabel as bookMallViewerTimeoutLabel };
