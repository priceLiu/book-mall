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
 * v002 P5-4：按对账批次某一行（按 userId 聚合所有 diff < 0 行）一键补扣到该用户钱包。
 * Body：{ userId, expectAmountPoints, secondConfirm: true, idempotencyTag?: string }
 *   - `expectAmountPoints` 防误点：前端二次确认时把当前显示的扣点数发回来；后端会重算 diff 并比对，
 *     若与当前算出的不一致（差额超过 1 点）则拒绝；
 *   - `secondConfirm` 必须为 true，否则 412；
 *   - 幂等键：`recon_clawback:${runId}:${userId}`；同 (runId, userId) 只能补扣一次。
 *   - 不允许把 balance 扣到负数；不足部分记 owed。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } },
) {
  const cors = financeCorsHeaders(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员" }, { status: 403, headers: cors });
  }
  const { runId } = params;
  if (!runId) {
    return NextResponse.json({ error: "缺少 runId" }, { status: 400, headers: cors });
  }

  let body: { userId?: string; expectAmountPoints?: number; secondConfirm?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请使用 application/json" }, { status: 400, headers: cors });
  }
  const targetUserId = body.userId?.trim();
  if (!targetUserId) {
    return NextResponse.json({ error: "userId 必填" }, { status: 400, headers: cors });
  }
  if (body.secondConfirm !== true) {
    return NextResponse.json(
      { error: "secondConfirm=true 必填（前端需二次确认）" },
      { status: 412, headers: cors },
    );
  }
  const expectPoints = body.expectAmountPoints;
  if (typeof expectPoints !== "number" || !Number.isFinite(expectPoints) || expectPoints <= 0) {
    return NextResponse.json({ error: "expectAmountPoints 须为正数" }, { status: 400, headers: cors });
  }

  const run = await prisma.billingReconciliationRun.findUnique({
    where: { id: runId },
    select: { id: true, status: true },
  });
  if (!run) {
    return NextResponse.json({ error: "对账批次不存在" }, { status: 404, headers: cors });
  }

  /** 收集该用户在本次批次内所有亏损行（diff < 0），求和得到本次应补扣金额。 */
  const lines = await prisma.billingReconciliationLine.findMany({
    where: { runId, userId: targetUserId },
  });
  if (lines.length === 0) {
    return NextResponse.json(
      { error: "该用户在本次对账批次内没有可补扣的行" },
      { status: 404, headers: cors },
    );
  }

  let totalDeficitYuan = 0;
  for (const l of lines) {
    const diff = Number(l.diffYuan);
    if (diff < 0) totalDeficitYuan += -diff;
  }
  const requiredPoints = Math.round(totalDeficitYuan * 100);
  if (requiredPoints <= 0) {
    return NextResponse.json(
      { error: "该用户在本次对账批次内未亏损，无需补扣" },
      { status: 409, headers: cors },
    );
  }
  if (Math.abs(requiredPoints - expectPoints) > 1) {
    return NextResponse.json(
      {
        error: `expectAmountPoints(${expectPoints}) 与服务端重算结果(${requiredPoints}) 不一致；可能数据已变动，请刷新报告后重试`,
      },
      { status: 409, headers: cors },
    );
  }

  const idempotencyKey = `recon_clawback:${runId}:${targetUserId}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const dup = await tx.walletEntry.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });
      if (dup) {
        return { duplicate: true as const, entryId: dup.id };
      }

      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: targetUserId },
        select: { id: true, balancePoints: true },
      });
      const clawPoints = Math.min(requiredPoints, Math.max(0, wallet.balancePoints));
      const owed = requiredPoints - clawPoints;
      const newBalance = wallet.balancePoints - clawPoints;

      if (clawPoints > 0) {
        await tx.wallet.update({
          where: { userId: targetUserId },
          data: { balancePoints: { decrement: clawPoints } },
        });
      }
      const entry = await tx.walletEntry.create({
        data: {
          walletId: wallet.id,
          type: "ADJUST",
          amountPoints: -clawPoints,
          balanceAfterPoints: newBalance,
          idempotencyKey,
          description:
            `对账补扣 · run=${runId} · 应补 ${requiredPoints} 点 / 实扣 ${clawPoints} 点` +
            (owed > 0 ? ` / 欠扣 ${owed} 点（余额不足）` : ""),
        },
        select: { id: true },
      });
      await tx.billingReconciliationLine.updateMany({
        where: { runId, userId: targetUserId, clawbackPoints: null },
        data: {
          clawbackPoints: clawPoints,
          clawbackEntryId: entry.id,
          clawedAt: new Date(),
        },
      });
      await tx.billingReconciliationRun.update({
        where: { id: runId },
        data: { status: "CLAWED_BACK" },
      });

      return {
        duplicate: false as const,
        entryId: entry.id,
        clawPoints,
        owedPoints: owed,
        newBalance,
      };
    });

    if (result.duplicate) {
      return NextResponse.json(
        { ok: true, duplicate: true, entryId: result.entryId },
        { headers: cors },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        duplicate: false,
        entryId: result.entryId,
        clawedPoints: result.clawPoints,
        owedPoints: result.owedPoints,
        balancePoints: result.newBalance,
      },
      { headers: cors },
    );
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code?: unknown }).code) : "";
    if (code === "P2002") {
      return NextResponse.json({ error: "幂等键冲突（已被补扣过）" }, { status: 409, headers: cors });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500, headers: cors });
  }
}
