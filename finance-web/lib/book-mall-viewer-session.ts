import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

export type BookMallViewerUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
};

/**
 * 读主站 NextAuth 会话（含 role），供 finance-web 顶栏 / 费用头等区分管理员与普通用户。
 */
export async function fetchBookMallViewerUser(
  base: string,
  signal?: AbortSignal,
): Promise<BookMallViewerUser | null> {
  if (!base) return null;
  try {
    const { url, init } = resolveBookMallBrowserRequest(base, "/api/finance/viewer-session", {
      signal,
    });
    const res = await fetch(url, init);
    if (!res.ok) return null;
    const j = (await res.json()) as { user: BookMallViewerUser | null };
    return j.user ?? null;
  } catch {
    return null;
  }
}
