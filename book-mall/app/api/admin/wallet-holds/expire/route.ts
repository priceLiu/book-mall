import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { releaseExpiredHolds } from "@/lib/wallet-holds";

export const dynamic = "force-dynamic";

/**
 * v003：把 HELD 且 expiresAt < now 的钱包预占用批量转 EXPIRED。
 *
 * 三种触发方式：
 *  1) 管理员浏览器登录后 POST：仅校验 NextAuth session.role === ADMIN
 *  2) 定时任务（Vercel Cron / 外部 scheduler）GET 调用：携带 `Authorization: Bearer <CRON_SECRET>`
 *     或 Vercel 平台自动注入的 `x-vercel-cron`/`x-vercel-signature`
 *  3) GET + ?secret=<CRON_SECRET>（不暴露在浏览器，仅给 health-check 脚本用）
 *
 * 注：reserveWalletHold 路径也会"机会主义"地清理一次过期 hold（轻量打扫），
 * 此端点用于主动批量回收（如用户账单结算前先扫一轮）。
 */
async function authorize(req: NextRequest): Promise<
  | { ok: true; via: "admin-session" | "cron-secret" | "vercel-cron" }
  | { ok: false; status: number; error: string }
> {
  // 1) Vercel Cron header
  if (req.headers.get("x-vercel-cron") === "1") {
    return { ok: true, via: "vercel-cron" };
  }
  // 2) Bearer / ?secret= 与 CRON_SECRET 比对
  const cronSecret = process.env.WALLET_HOLDS_CRON_SECRET ?? process.env.CRON_SECRET ?? "";
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    const match = auth.match(/^Bearer\s+(.+)$/i);
    const bearer = match ? match[1]!.trim() : "";
    const querySecret = req.nextUrl.searchParams.get("secret") ?? "";
    if ((bearer && bearer === cronSecret) || (querySecret && querySecret === cronSecret)) {
      return { ok: true, via: "cron-secret" };
    }
  }
  // 3) 管理员 session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "未登录" };
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (me?.role !== "ADMIN") {
    return { ok: false, status: 403, error: "需要管理员权限或 CRON_SECRET" };
  }
  return { ok: true, via: "admin-session" };
}

async function runExpire(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const expired = await releaseExpiredHolds();
  return NextResponse.json({
    ok: true,
    expired,
    via: auth.via,
    at: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  return runExpire(req);
}

export async function GET(req: NextRequest) {
  return runExpire(req);
}
