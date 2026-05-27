import { cookies } from "next/headers";
import { getBookMallOrigin } from "./book-mall-base-url";

export async function gatewayFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const base = getBookMallOrigin();
  if (!base) {
    return new Response(JSON.stringify({ error: "BOOK_MALL_ORIGIN 未配置" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("gateway_token")?.value;

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Cookie", `gateway_token=${token}`);
  }
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    return await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (e: unknown) {
    return new Response(
      JSON.stringify({
        error: "book_mall_fetch_failed",
        message: e instanceof Error ? e.message : String(e),
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function gatewayJson<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await gatewayFetch(path, init);
  const data = (await res.json().catch(() => null)) as T | null;
  return { ok: res.ok, status: res.status, data };
}
