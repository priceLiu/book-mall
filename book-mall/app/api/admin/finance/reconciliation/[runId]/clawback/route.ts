import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  consumeCredits,
  getCreditBalance,
} from "@/lib/billing/credit-account-service";
import { DEFAULT_CREDIT_ANCHOR_YUAN } from "@/lib/pricing/credit-pricing-formulas";
import { prisma } from "@/lib/prisma";
import { financeCorsHeaders } from "@/lib/finance/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: financeCorsHeaders(request) });
}

/** 对账补扣：从用户积分账户（通用池）扣减，替代钱包。 */
export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } },
) {
  const cors = financeCorsHeaders(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !canViewFinanceCost(session.user.role)) {
    return NextResponse.json({ error: "需要财务管理员权限" }, { status: 403, headers: cors });
  }
  const { runId } = params;
  if (!runId) {
    return NextResponse.json({ error: "缺少 runId" }, { status: 400, headers: cors });
  }

  let body: {
    userId?: string;
    expectAmountPoints?: number;
    expectCredits?: number;
    secondConfirm?: boolean;
  };
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
  const expectCredits =
    typeof body.expectCredits === "number" && body.expectCredits > 0
      ? body.expectCredits
      : typeof body.expectAmountPoints === "number" && body.expectAmountPoints > 0
        ? body.expectAmountPoints
        : null;
  if (expectCredits == null) {
    return NextResponse.json({ error: "expectCredits 须为正数" }, { status: 400, headers: cors });
  }

  const run = await prisma.billingReconciliationRun.findUnique({
    where: { id: runId },
    select: { id: true, status: true },
  });
  if (!run) {
    return NextResponse.json({ error: "对账批次不存在" }, { status: 404, headers: cors });
  }

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
  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId: targetUserId } },
    select: { pricePerCreditYuan: true },
  });
  const ppc =
    account?.pricePerCreditYuan != null && Number(account.pricePerCreditYuan) > 0
      ? Number(account.pricePerCreditYuan)
      : DEFAULT_CREDIT_ANCHOR_YUAN;
  const requiredCredits = Math.max(1, Math.ceil(totalDeficitYuan / ppc));
  if (requiredCredits <= 0) {
    return NextResponse.json(
      { error: "该用户在本次对账批次内未亏损，无需补扣" },
      { status: 409, headers: cors },
    );
  }
  if (Math.abs(requiredCredits - expectCredits) > 1) {
    return NextResponse.json(
      {
        error: `expectCredits(${expectCredits}) 与服务端重算(${requiredCredits}) 不一致；请刷新后重试`,
      },
      { status: 409, headers: cors },
    );
  }

  const idempotencyKey = `recon_clawback:${runId}:${targetUserId}`;
  const dup = await prisma.creditLedger.findFirst({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json({ ok: true, duplicate: true, ledgerId: dup.id }, { headers: cors });
  }

  const balanceBefore = await getCreditBalance({ ownerType: "USER", ownerId: targetUserId });
  const clawCredits = Math.min(requiredCredits, Math.max(0, balanceBefore));
  const owedCredits = requiredCredits - clawCredits;

  if (clawCredits > 0) {
    await consumeCredits({
      ref: { ownerType: "USER", ownerId: targetUserId },
      credits: clawCredits,
      pool: "GENERAL",
      idempotencyKey,
      description: `对账补扣 · run=${runId} · 应补 ${requiredCredits} / 实扣 ${clawCredits}` +
        (owedCredits > 0 ? ` / 欠扣 ${owedCredits}` : ""),
    });
  }

  const ledger = await prisma.creditLedger.findFirst({
    where: { idempotencyKey },
    select: { id: true },
  });

  await prisma.billingReconciliationLine.updateMany({
    where: { runId, userId: targetUserId, clawbackPoints: null },
    data: {
      clawbackPoints: clawCredits,
      clawbackEntryId: ledger?.id ?? null,
      clawedAt: new Date(),
    },
  });
  await prisma.billingReconciliationRun.update({
    where: { id: runId },
    data: { status: "CLAWED_BACK" },
  });

  const balanceAfter = await getCreditBalance({ ownerType: "USER", ownerId: targetUserId });

  return NextResponse.json(
    {
      ok: true,
      duplicate: false,
      ledgerId: ledger?.id ?? null,
      clawedCredits: clawCredits,
      owedCredits,
      balanceCredits: balanceAfter,
    },
    { headers: cors },
  );
}
