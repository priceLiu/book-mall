/**
 * 内部 Cron / CLI 鉴权（对齐 wallet-holds/expire）。
 */
import type { NextRequest } from "next/server";

export type InternalCronAuthResult =
  | { ok: true; via: "cron-secret" | "vercel-cron" }
  | { ok: false; status: number; error: string };

export function authorizeInternalCron(req: NextRequest): InternalCronAuthResult {
  if (req.headers.get("x-vercel-cron") === "1") {
    return { ok: true, via: "vercel-cron" };
  }

  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";
  if (!cronSecret) {
    return { ok: false, status: 503, error: "CRON_SECRET 未配置" };
  }

  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const bearer = match ? match[1]!.trim() : "";
  const querySecret = req.nextUrl.searchParams.get("secret") ?? "";

  if (bearer === cronSecret || querySecret === cronSecret) {
    return { ok: true, via: "cron-secret" };
  }

  return { ok: false, status: 403, error: "需要 CRON_SECRET" };
}
