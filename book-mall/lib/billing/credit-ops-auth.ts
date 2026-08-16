import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Cron / 管理员鉴权（同 credits/expire-sweep）。 */
export async function authorizeCreditOpsCron(
  req: NextRequest,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
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
