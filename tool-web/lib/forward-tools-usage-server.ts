import { cookies } from "next/headers";
import { getMainSiteOrigin } from "@/lib/site-origin";

/** AI智能试衣：成片成功且写出计费点后上报主站 try_on（与 Beacon page_view 分离）；详见 doc/payment.md。 */
export async function recordToolUsageFromServer(opts: {
  toolKey: string;
  action: string;
  /** 主站优先采用的扣费点数（正整数）；与 book-mall `POST /api/sso/tools/usage` 一致。 */
  costPoints?: number;
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
        ...(typeof opts.costPoints === "number" &&
        Number.isFinite(opts.costPoints) &&
        opts.costPoints > 0
          ? { costPoints: Math.floor(opts.costPoints) }
          : {}),
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

/** 同步调用主站计费接口并返回响应体（用于余额不足 402 等需告知前端的场景）。 */
export async function postToolUsageFromServer(opts: {
  toolKey: string;
  action: string;
  costPoints?: number;
  meta?: Record<string, unknown>;
}): Promise<
  | { ok: false; reason: "no_session" | "no_origin" }
  | { ok: true; status: number; data: Record<string, unknown> }
> {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) return { ok: false, reason: "no_session" };

  const origin = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!origin?.length) return { ok: false, reason: "no_origin" };

  const r = await fetch(`${origin}/api/sso/tools/usage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      toolKey: opts.toolKey,
      action: opts.action,
      ...(typeof opts.costPoints === "number" &&
      Number.isFinite(opts.costPoints) &&
      opts.costPoints > 0
        ? { costPoints: Math.floor(opts.costPoints) }
        : {}),
      ...(opts.meta ? { meta: opts.meta } : {}),
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
