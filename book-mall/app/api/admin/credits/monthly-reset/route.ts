import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runMonthlyResetSweep } from "@/lib/billing/credit-account-service";

export const dynamic = "force-dynamic";

/**
 * 订阅积分月度重置清扫（积分清零 1.0）：对 currentPeriodEnd 已到期的订阅账户按月刷新
 * （清上一周期订阅积分、发放本周期，保留充值/免费批次），并推进 currentPeriodEnd。
 * 触发方式同 credits/expire-sweep。
 */
async function authorize(req: NextRequest): Promise<
  { ok: true } | { ok: false; status: number; error: string }
> {
  if (req.headers.get("x-vercel-cron") === "1") return { ok: true };
  const cronSecret = process.env.CREDITS_CRON_SECRET ?? process.env.CRON_SECRET ?? "";
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const bearer = m ? m[1]!.trim() : "";
    const q = req.nextUrl.searchParams.get("secret") ?? "";
    if ((bearer && bearer === cronSecret) || (q && q === cronSecret)) return { ok: true };
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false, status: 401, error: "未登录" };
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (me?.role !== "ADMIN") return { ok: false, status: 403, error: "需要管理员权限或 CRON_SECRET" };
  return { ok: true };
}

async function run(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const result = await runMonthlyResetSweep();
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}
