"use client";

import { throwIfUnauthorized } from "@/lib/auth";
import { refreshToolsSessionClient } from "@/lib/tools-session-client";

function rawBookFetch(path: string, init?: RequestInit) {
  return fetch(`/api/book-mall/${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers ?? {}),
    },
  });
}

function isReplayableBody(body: BodyInit | null | undefined): boolean {
  if (body == null) return true;
  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
    return false;
  }
  return true;
}

export async function bookFetch(path: string, init?: RequestInit) {
  let res = await rawBookFetch(path, init);

  if (res.status === 401 && isReplayableBody(init?.body)) {
    const refreshed = await refreshToolsSessionClient();
    if (refreshed) {
      res = await rawBookFetch(path, init);
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
