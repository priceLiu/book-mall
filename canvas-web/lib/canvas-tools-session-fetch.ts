"use client";

import { parseToolsSessionPayload } from "@/lib/parse-tools-session-payload";
import type { FetchToolsSessionResult } from "@/lib/tools-introspect";
import {
  setCachedToolsSession,
} from "@/lib/tools-session-client-cache";

export type CanvasToolsSessionClientPayload = FetchToolsSessionResult;

let inflightLite: Promise<CanvasToolsSessionClientPayload> | null = null;
let inflightFull: Promise<CanvasToolsSessionClientPayload> | null = null;

async function fetchSession(url: string): Promise<CanvasToolsSessionClientPayload> {
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  const raw = await res.json().catch(() => null);
  const parsed = parseToolsSessionPayload(raw);
  if (parsed.active) {
    setCachedToolsSession(parsed);
  }
  return parsed;
}

/** 心跳 / 路由切换：仅 JWT 过期判断，不阻塞在 introspect */
export function fetchCanvasToolsSessionLite(): Promise<CanvasToolsSessionClientPayload> {
  if (!inflightLite) {
    inflightLite = fetchSession("/api/tools-session?lite=1").finally(() => {
      inflightLite = null;
    });
  }
  return inflightLite;
}

/** 登录门禁 / 积分 / 管理员判定：含 introspect（同页 inflight 去重） */
export function fetchCanvasToolsSessionFull(): Promise<CanvasToolsSessionClientPayload> {
  if (!inflightFull) {
    inflightFull = fetchSession("/api/tools-session").finally(() => {
      inflightFull = null;
    });
  }
  return inflightFull;
}
