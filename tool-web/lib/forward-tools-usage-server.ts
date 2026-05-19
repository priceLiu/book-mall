import { cookies } from "next/headers";
import { getMainSiteOrigin } from "@/lib/site-origin";

/**
 * v002（清理）：向主站 `/api/sso/tools/usage` 上报使用事件。
 * - 不再支持 `costPoints` 字段：定价由主站 `ToolBillablePrice` 表唯一决定，工具站只发 toolKey/action/meta。
 * - meta 必须能解析到模型 key（任一字段：`modelId / apiModel / videoModel / textToImageModel / tryOnModel`），否则主站无法定价。
 */
export async function recordToolUsageFromServer(opts: {
  toolKey: string;
  action: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) return;

  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin?.length) return;

  try {
    const r = await fetch(`${origin}/api/sso/tools/usage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        toolKey: opts.toolKey,
        action: opts.action,
        ...(opts.meta ? { meta: opts.meta } : {}),
      }),
      cache: "no-store",
    });
    if (!r.ok) {
      const detail = (await r.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      console.error("[recordToolUsageFromServer]", r.status, detail);
    }
  } catch (e) {
    console.error("[recordToolUsageFromServer]", e);
  }
}

/**
 * v003：reserve 一笔预占用（hold）。
 * 用于按秒/按张计费工具在调用云厂商前做水位线门禁；若返回 402，前端提示"先充值再生成"，避免无谓的云调用。
 */
export async function reserveWalletHoldFromServer(opts: {
  toolKey: string;
  action?: string;
  estimatedMaxPoints: number;
  taskKey?: string;
  meta?: Record<string, unknown>;
}): Promise<
  | { ok: false; reason: "no_session" | "no_origin" }
  | { ok: true; status: number; data: Record<string, unknown> }
> {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) return { ok: false, reason: "no_session" };

  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin?.length) return { ok: false, reason: "no_origin" };

  const r = await fetch(`${origin}/api/sso/tools/usage?phase=reserve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phase: "reserve",
      toolKey: opts.toolKey,
      action: opts.action ?? null,
      estimatedMaxPoints: opts.estimatedMaxPoints,
      ...(opts.taskKey ? { taskKey: opts.taskKey } : {}),
      ...(opts.meta ? { meta: opts.meta } : {}),
    }),
    cache: "no-store",
  });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: true, status: r.status, data };
}

/**
 * v003：release 一笔预占用（hold）。
 * 用于云生成失败或用户取消时释放 reserved 点数（幂等，已 SETTLED 时返回 409 不影响业务）。
 */
export async function releaseWalletHoldFromServer(opts: {
  holdId?: string;
  taskKey?: string;
  reason?: string;
}): Promise<{ ok: boolean; status?: number; data?: Record<string, unknown> }> {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) return { ok: false };
  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin?.length) return { ok: false };
  try {
    const r = await fetch(`${origin}/api/sso/tools/usage?phase=release`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phase: "release",
        ...(opts.holdId ? { holdId: opts.holdId } : {}),
        ...(opts.taskKey ? { taskKey: opts.taskKey } : {}),
        ...(opts.reason ? { reason: opts.reason } : {}),
      }),
      cache: "no-store",
    });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: true, status: r.status, data };
  } catch (e) {
    console.error("[releaseWalletHoldFromServer]", e);
    return { ok: false };
  }
}

/** 同步调用主站计费接口并返回响应体（用于余额不足 402 等需告知前端的场景）。 */
export async function postToolUsageFromServer(opts: {
  toolKey: string;
  action: string;
  meta?: Record<string, unknown>;
  /** v003：settle 时若已 reserve，可附带 holdId 让主站 settle 内同步把 hold 转 SETTLED */
  holdId?: string;
}): Promise<
  | { ok: false; reason: "no_session" | "no_origin" }
  | { ok: true; status: number; data: Record<string, unknown> }
> {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) return { ok: false, reason: "no_session" };

  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin?.length) return { ok: false, reason: "no_origin" };

  const r = await fetch(`${origin}/api/sso/tools/usage${opts.holdId ? "?phase=settle" : ""}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      toolKey: opts.toolKey,
      action: opts.action,
      ...(opts.meta ? { meta: opts.meta } : {}),
      ...(opts.holdId ? { phase: "settle", holdId: opts.holdId } : {}),
    }),
    cache: "no-store",
  });

  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: true, status: r.status, data };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RETRYABLE_USAGE_HTTP = new Set([502, 503, 504, 429]);

export type PostToolUsageFromServerResult = Awaited<
  ReturnType<typeof postToolUsageFromServer>
>;

/**
 * 向主站 `/api/sso/tools/usage` 上报，带指数退避重试（网络抖动 / 502–504）。
 * 不重试 401、402、404 等确定性响应。
 */
export async function postToolUsageFromServerWithRetries(
  opts: Parameters<typeof postToolUsageFromServer>[0],
  options?: { maxAttempts?: number; baseDelayMs?: number },
): Promise<PostToolUsageFromServerResult> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 4);
  const baseDelayMs = options?.baseDelayMs ?? 350;

  let last: PostToolUsageFromServerResult | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      last = await postToolUsageFromServer(opts);
      if (!last.ok) {
        return last;
      }
      const st = last.status;
      if (st >= 200 && st < 300) {
        return last;
      }
      if (!RETRYABLE_USAGE_HTTP.has(st)) {
        return last;
      }
      if (attempt < maxAttempts) {
        await delay(baseDelayMs * 2 ** (attempt - 1));
      }
    } catch (e) {
      console.error("[postToolUsageFromServerWithRetries] attempt failed", attempt, e);
      if (attempt >= maxAttempts) {
        throw e;
      }
      await delay(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  return last!;
}
