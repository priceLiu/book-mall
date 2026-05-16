import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { financeCorsHeaders } from "@/lib/finance/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: financeCorsHeaders(request) });
}

/**
 * v002 P5：绑定（或更新）云账号 → 平台 User。
 * Body：{ cloudAccountId, userId, cloudAccountName?, note? }
 */
export async function POST(request: NextRequest) {
  const cors = financeCorsHeaders(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员" }, { status: 403, headers: cors });
  }

  let body: { cloudAccountId?: string; userId?: string; cloudAccountName?: string; note?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请使用 application/json" }, { status: 400, headers: cors });
  }
  const cloudAccountId = body.cloudAccountId?.trim();
  const userId = body.userId?.trim();
  if (!cloudAccountId || !userId) {
    return NextResponse.json({ error: "cloudAccountId 与 userId 必填" }, { status: 400, headers: cors });
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404, headers: cors });
  }

  const binding = await prisma.cloudAccountBinding.upsert({
    where: { cloudAccountId },
    create: {
      cloudAccountId,
      userId,
      cloudAccountName: body.cloudAccountName?.trim() || null,
      note: body.note?.trim() || null,
    },
    update: {
      userId,
      cloudAccountName: body.cloudAccountName?.trim() || null,
      note: body.note?.trim() || null,
    },
  });
  return NextResponse.json({ ok: true, binding }, { headers: cors });
}

/** 列出现有绑定（便于管理界面下拉） */
export async function GET(request: NextRequest) {
  const cors = financeCorsHeaders(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员" }, { status: 403, headers: cors });
  }
  const bindings = await prisma.cloudAccountBinding.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ bindings }, { headers: cors });
}
