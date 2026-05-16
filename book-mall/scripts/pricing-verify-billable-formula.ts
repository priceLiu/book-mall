/**
 * 只读校验：
 *   (A) ToolBillablePrice：pricePoints ≈ max(1, round(cost * mult * 100))
 *   (B) v002 P3-3 新增：ToolBillablePrice.schemeAUnitCostYuan ↔ PricingSourceLine.listUnitYuan 漂移检测
 *       - 对 BillablePrice 行（schemeARefModelKey 非空），到「当前版本（isCurrent=true）」的 PricingSourceLine
 *         里找 modelKey === schemeARefModelKey 的行（取一条；后续 P1-1 用 cloudModelKey 精确匹配）；
 *         比较「按当前 billingKind 解释的 listUnitYuan」与 schemeAUnitCostYuan。
 *       - 阈值默认 0.01 元；超过则记入 drift 列表（不阻塞，但 exit code = 3 以便 CI 关注）。
 *
 * pnpm pricing:verify-billable-formula
 */
import { prisma } from "../lib/prisma";

function expectedPoints(cost: number, mult: number): number {
  const retail = cost * mult;
  return Math.max(1, Math.round(retail * 100));
}

const COST_DRIFT_THRESHOLD_YUAN = 0.01;

/**
 * 返回 PricingSourceLine 中可用于「直接对比 storedCostYuan(元/次)」的源单价。
 *
 * - TOKEN_IN_OUT：storedCost 是「一次调用的元/次」，而 source 是「元/MTokens」，**单位不可比** → 跳过。
 * - OUTPUT_IMAGE / COST_PER_IMAGE：源若提供 `perImageYuan` 才可比。
 * - VIDEO_MODEL_SPEC：源若按 tier 给 `1080P`/`720P` 字段或 `perSecondYuan` 才可比；但 storedCost 在我们口径下是「元/次任务」，仍**单位不可比** → 跳过。
 *
 * 不可比的行返回 `comparable=false` 与 `reason`，不计入 drift 列表。
 */
function resolveListUnitYuanFromPricingLine(line: {
  billingKind: string;
  inputYuanPerMillion: number | null;
  outputYuanPerMillion: number | null;
  costJson: unknown;
  tierRaw: string;
}):
  | { comparable: true; listUnitYuan: number; unitLabel: string }
  | { comparable: false; reason: string; unitLabel: string } {
  const kind = String(line.billingKind);
  if (kind === "TOKEN_IN_OUT") {
    return {
      comparable: false,
      reason: "TOKEN_IN_OUT 源单价为元/MTokens；库内 storedCost 为元/次，单位不可直接比对",
      unitLabel: "元/MTokens",
    };
  }
  if (kind === "OUTPUT_IMAGE" || kind === "COST_PER_IMAGE") {
    const cj = line.costJson as Record<string, unknown> | null;
    if (cj && typeof cj.perImageYuan === "number") {
      return { comparable: true, listUnitYuan: cj.perImageYuan, unitLabel: "元/张" };
    }
    return {
      comparable: false,
      reason: "PricingSourceLine.costJson 未提供 perImageYuan",
      unitLabel: "元/张",
    };
  }
  if (kind === "VIDEO_MODEL_SPEC") {
    return {
      comparable: false,
      reason: "VIDEO_MODEL_SPEC 源单价为元/秒；库内 storedCost 为元/次任务，单位不可直接比对",
      unitLabel: "元/秒",
    };
  }
  return {
    comparable: false,
    reason: `未知 billingKind: ${kind}`,
    unitLabel: "",
  };
}

async function main() {
  const rows = await prisma.toolBillablePrice.findMany({
    where: { active: true },
    orderBy: [{ toolKey: "asc" }, { action: "asc" }, { schemeARefModelKey: "asc" }],
  });

  const mismatches: Array<{
    id: string;
    toolKey: string;
    action: string | null;
    ref: string | null;
    pricePoints: number;
    cost: number;
    mult: number;
    expected: number;
  }> = [];

  for (const r of rows) {
    const cost = r.schemeAUnitCostYuan;
    const mult = r.schemeAAdminRetailMultiplier;
    if (
      cost == null ||
      mult == null ||
      !Number.isFinite(cost) ||
      !Number.isFinite(mult) ||
      cost < 0 ||
      mult <= 0
    ) {
      continue;
    }
    const exp = expectedPoints(cost, mult);
    if (r.pricePoints !== exp) {
      mismatches.push({
        id: r.id,
        toolKey: r.toolKey,
        action: r.action,
        ref: r.schemeARefModelKey,
        pricePoints: r.pricePoints,
        cost,
        mult,
        expected: exp,
      });
    }
  }

  const drifts: Array<{
    billableId: string;
    toolKey: string;
    refModel: string;
    storedCostYuan: number;
    sourceListUnitYuan: number;
    diffYuan: number;
    unitLabel: string;
  }> = [];

  const skipped: Array<{
    billableId: string;
    toolKey: string;
    refModel: string;
    storedCostYuan: number;
    reason: string;
    unitLabel: string;
  }> = [];

  const currentVersion = await prisma.pricingSourceVersion.findFirst({
    where: { isCurrent: true },
    select: { id: true, kind: true, importedAt: true },
  });

  if (currentVersion) {
    const refModels = rows
      .map((r) => r.schemeARefModelKey)
      .filter((s): s is string => !!s && s.length > 0);
    const lines = refModels.length
      ? await prisma.pricingSourceLine.findMany({
          where: { versionId: currentVersion.id, modelKey: { in: refModels } },
          select: {
            modelKey: true,
            tierRaw: true,
            billingKind: true,
            inputYuanPerMillion: true,
            outputYuanPerMillion: true,
            costJson: true,
          },
        })
      : [];
    const linesByModel = new Map<string, (typeof lines)[number][]>();
    for (const l of lines) {
      const arr = linesByModel.get(l.modelKey) ?? [];
      arr.push(l);
      linesByModel.set(l.modelKey, arr);
    }

    for (const r of rows) {
      if (!r.schemeARefModelKey) continue;
      if (
        r.schemeAUnitCostYuan == null ||
        !Number.isFinite(r.schemeAUnitCostYuan)
      ) {
        continue;
      }
      const candidates = linesByModel.get(r.schemeARefModelKey) ?? [];
      if (candidates.length === 0) {
        skipped.push({
          billableId: r.id,
          toolKey: r.toolKey,
          refModel: r.schemeARefModelKey,
          storedCostYuan: r.schemeAUnitCostYuan,
          reason: "当前版本 PricingSourceLine 未找到 modelKey 同名行",
          unitLabel: "(missing-source)",
        });
        continue;
      }
      const line = candidates[0]!;
      const res = resolveListUnitYuanFromPricingLine(line);
      if (!res.comparable) {
        skipped.push({
          billableId: r.id,
          toolKey: r.toolKey,
          refModel: r.schemeARefModelKey,
          storedCostYuan: r.schemeAUnitCostYuan,
          reason: res.reason,
          unitLabel: res.unitLabel,
        });
        continue;
      }
      const diff = r.schemeAUnitCostYuan - res.listUnitYuan;
      if (Math.abs(diff) > COST_DRIFT_THRESHOLD_YUAN) {
        drifts.push({
          billableId: r.id,
          toolKey: r.toolKey,
          refModel: r.schemeARefModelKey,
          storedCostYuan: r.schemeAUnitCostYuan,
          sourceListUnitYuan: res.listUnitYuan,
          diffYuan: diff,
          unitLabel: res.unitLabel,
        });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        checkedRowsWithCostAndMult: rows.filter(
          (r) =>
            r.schemeAUnitCostYuan != null &&
            r.schemeAAdminRetailMultiplier != null &&
            Number.isFinite(r.schemeAUnitCostYuan) &&
            Number.isFinite(r.schemeAAdminRetailMultiplier),
        ).length,
        mismatches: mismatches.length,
        mismatchDetail: mismatches,
        sourceVersion: currentVersion?.id ?? null,
        drifts: drifts.length,
        driftThresholdYuan: COST_DRIFT_THRESHOLD_YUAN,
        driftDetail: drifts,
        skipped: skipped.length,
        skippedDetail: skipped,
      },
      null,
      2,
    ),
  );

  if (mismatches.length > 0) process.exit(2);
  if (drifts.length > 0) process.exit(3);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
