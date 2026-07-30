"use client";

import { throwIfUnauthorized } from "@/lib/ecom-auth";
import { refreshEcomToolsSessionClient } from "@/lib/ecom-tools-session-client";

function rawEcomBookFetch(path: string, init?: RequestInit) {
  return fetch(`/api/book-mall/${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers ?? {}),
    },
  });
}

/** body 为一次性流时不可重放，跳过 401 重试 */
function isReplayableBody(body: BodyInit | null | undefined): boolean {
  if (body == null) return true;
  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
    return false;
  }
  return true;
}

export async function ecomBookFetch(path: string, init?: RequestInit) {
  let res = await rawEcomBookFetch(path, init);

  // 令牌过期 → 服务端 refresh 后重试一次
  if (res.status === 401 && isReplayableBody(init?.body)) {
    const refreshed = await refreshEcomToolsSessionClient();
    if (refreshed) {
      res = await rawEcomBookFetch(path, init);
    }
  }

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* */
  }
  throwIfUnauthorized(res, data);
  if (!res.ok) {
    const err =
      typeof data.error === "string" ? data.error : `请求失败 (${res.status})`;
    throw new Error(err);
  }
  return data;
}
