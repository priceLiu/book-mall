import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** 开发环境模拟订阅开通（月度 30 天 / 年度 365 天） */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "仅开发环境可用" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let planSlug = "monthly";
  try {
    const body = await req.json();
    if (typeof body?.planSlug === "string") {
      const s = body.planSlug.trim().toLowerCase();
      if (s === "monthly" || s === "yearly") planSlug = s;
    }
  } catch {
    /* empty body */
  }

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { slug: planSlug },
  });
  if (!plan) {
    return NextResponse.json(
      { error: `未找到计划「${planSlug}」，请先执行 pnpm db:seed` },
      { status: 400 },
    );
  }

  const start = new Date();
  const end = new Date(start);
  const addDays = plan.interval === "YEAR" ? 365 : 30;
  end.setDate(end.getDate() + addDays);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.updateMany({
      where: { userId: session.user.id, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
    const sub = await tx.subscription.create({
      data: {
        userId: session.user.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: start,
        currentPeriodEnd: end,
      },
    });
    await tx.order.create({
      data: {
        userId: session.user.id,
        type: "SUBSCRIPTION",
        status: "PAID",
        amountMinor: plan.priceMinor,
        paidAt: new Date(),
        meta: {
          mock: true,
          planSlug: plan.slug,
          subscriptionId: sub.id,
        },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
