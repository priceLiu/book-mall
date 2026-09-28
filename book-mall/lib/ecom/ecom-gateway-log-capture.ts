import { AsyncLocalStorage } from "node:async_hooks";

import { NextResponse } from "next/server";

type Bag = { logIds: string[] };

const storage = new AsyncLocalStorage<Bag>();

/** 与电商前端结算监听约定的响应头（流式生成无法在 JSON 里带回 logId）。 */
export const ECOM_GATEWAY_LOG_HEADER = "x-ecom-gateway-log-id";

/**
 * 在当前请求的异步上下文里开始收集 Gateway log。
 * 须在路由处理函数同步阶段调用（`verifyToolsBearer`），后续 await 仍能读到。
 */
export function beginEcomGatewayLogCapture() {
  if (storage.getStore()) return;
  storage.enterWith({ logIds: [] });
}

export function noteEcomGatewayLogId(logId: string | null | undefined) {
  const id = logId?.trim() ?? "";
  if (id.length <= 8) return;
  const bag = storage.getStore();
  if (!bag || bag.logIds.includes(id)) return;
  bag.logIds.push(id);
}

export function peekEcomGatewayLogIds(): string[] {
  return storage.getStore()?.logIds.slice() ?? [];
}

export function ecomGatewayLogHeaders(): Record<string, string> {
  const ids = peekEcomGatewayLogIds();
  if (ids.length === 0) return {};
  return { [ECOM_GATEWAY_LOG_HEADER]: ids.join(",") };
}

function mergeLogIds(body: Record<string, unknown>, captured: string[]): string[] {
  const ids: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim().length > 8) ids.push(value.trim());
  };
  push(body.logId);
  if (Array.isArray(body.logIds)) {
    for (const id of body.logIds) push(id);
  }
  for (const id of captured) push(id);
  return [...new Set(ids)];
}

/** 电商 JSON 响应：若本次请求创建了 Gateway log，附上 `logIds` 供前端跟踪冻结 / 实扣 / 释放。 */
export function ecomJson(body: unknown, init?: ResponseInit) {
  const captured = peekEcomGatewayLogIds();
  if (
    captured.length === 0 ||
    body == null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return NextResponse.json(body, init);
  }
  const logIds = mergeLogIds(body as Record<string, unknown>, captured);
  if (logIds.length === 0) return NextResponse.json(body, init);
  return NextResponse.json({ ...(body as Record<string, unknown>), logIds }, init);
}
