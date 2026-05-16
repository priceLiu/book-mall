/**
 * v002（第 1 项）：工具站价格全量核查（运营定期跑一次，输出表给老板看）。
 *
 * 与 `pricing:verify-billable-formula` 的差异：
 *   - verify 只做「stored cost × M × 100 = stored points」自洽校验；
 *   - audit 把每行的 stored 价格摆出来，并按价格源(PricingSourceLine) 标注是否「可自动核对」。
 *
 * 三类行的处理：
 *   - OUTPUT_IMAGE / COST_PER_IMAGE：源 `costJson.perImageYuan` 存在则对比 `schemeAUnitCostYuan`；
 *   - VIDEO_MODEL_SPEC：源 `costJson.<tier>` 或 `costJson.perSecondYuan` 存在则按 5 秒典型对比；
 *   - TOKEN_IN_OUT：单位不可直接比对（stored 为 元/次, 源为 元/MTokens），仅输出 input/output 单价供人工核对；
 *
 * 限制（与现实数据吻合）：
 *   - 当前 `pricing-import-markdown` 解析器只解析 token 类区块（tool-web price.md 主体）；
 *   - 图像/视频类 perImage/perSecond 单价**尚未进**入 PricingSourceLine.costJson；该类行报告里标
 *     `(SOURCE_NO_UNIT_PRICE)`，由运营在 `tool-web/doc/price.md` 中按表手对核 stored cost。
 *
 * 退出码：
 *   - 0：无图像/视频类的真漂（差额 > 阈值）；
 *   - 3：图像/视频类出现明确漂移（仅在源给出 perImage/perSecond 时报）。
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";

const COST_AUDIT_THRESHOLD_YUAN = 0.05;

type AuditRow = {
  billableId: string;
  toolKey: string;
  action: string | null;
  refModel: string | null;
  cloudTier: string | null;
  cloudBillingKind: string | null;
  storedCostYuan: number | null;
  inferredCostYuan: number | null;
  inferredBasis: string;
  diffYuan: number | null;
  multiplier: number | null;
  storedPoints: number;
  inferredPoints: number | null;
  unitLabel: string;
  reason?: string;
};

function inferCostFromSourceLine(line: {
  billingKind: string;
  inputYuanPerMillion: number | null;
  outputYuanPerMillion: number | null;
  costJson: unknown;
  tierRaw: string;
}, billableTier: string | null): { yuan: number | null; basis: string; unitLabel: string } {
  const cj = (line.costJson ?? {}) as Record<string, unknown>;
  const kind = String(line.billingKind);
  if (kind === "OUTPUT_IMAGE" || kind === "COST_PER_IMAGE") {
    const v = typeof cj.perImageYuan === "number" ? (cj.perImageYuan as number) : null;
    return {
      yuan: v,
      basis: v != null ? `source.costJson.perImageYuan=${v}` : "源 costJson 未提供 perImageYuan",
      unitLabel: "元/张",
    };
  }
  if (kind === "VIDEO_MODEL_SPEC") {
    // 优先用 billableTier 匹配；如 `720P` / `1080P`
    const tierKey = (billableTier || line.tierRaw || "").trim();
    const direct =
      tierKey && typeof cj[tierKey] === "number" ? Number(cj[tierKey]) : null;
    if (direct != null) {
      const perSec = direct;
      const typicalSec = 5;
      return {
        yuan: perSec * typicalSec,
        basis: `source.costJson["${tierKey}"]=${perSec} 元/秒 × 5s(典型)`,
        unitLabel: "元/次任务",
      };
    }
    const perSec =
      typeof cj.perSecondYuan === "number" ? Number(cj.perSecondYuan) : null;
    if (perSec != null) {
      return {
        yuan: perSec * 5,
        basis: `source.costJson.perSecondYuan=${perSec} 元/秒 × 5s(典型)`,
        unitLabel: "元/次任务",
      };
    }
    return { yuan: null, basis: "源 costJson 未提供 tier/perSecondYuan", unitLabel: "元/次任务" };
  }
  if (kind === "TOKEN_IN_OUT") {
    const inp = line.inputYuanPerMillion ?? 0;
    const out = line.outputYuanPerMillion ?? 0;
    return {
      yuan: null,
      basis: `(TOKEN_IN_OUT) input=${inp} 元/MTokens, output=${out} 元/MTokens; stored cost 单位为"元/次"，自动核对不可比较，请人工对照 price.md`,
      unitLabel: "元/MTokens",
    };
  }
  return { yuan: null, basis: `未知 billingKind: ${kind}`, unitLabel: "" };
}

async function main() {
  const rows = await prisma.toolBillablePrice.findMany({
    select: {
      id: true,
      toolKey: true,
      action: true,
      pricePoints: true,
      schemeAUnitCostYuan: true,
      schemeAAdminRetailMultiplier: true,
      schemeARefModelKey: true,
      cloudTierRaw: true,
      cloudBillingKind: true,
    },
    orderBy: [{ toolKey: "asc" }, { action: "asc" }, { schemeARefModelKey: "asc" }],
  });

  const currentVersion = await prisma.pricingSourceVersion.findFirst({
    where: { isCurrent: true },
    select: { id: true, importedAt: true },
  });
  if (!currentVersion) {
    console.error("无 PricingSourceVersion.isCurrent=true；请先 `pnpm pricing:import-markdown`");
    process.exit(2);
  }

  const refModels = rows.map((r) => r.schemeARefModelKey).filter((s): s is string => !!s);
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

  const out: AuditRow[] = [];
  for (const r of rows) {
    if (!r.schemeARefModelKey) {
      out.push({
        billableId: r.id,
        toolKey: r.toolKey,
        action: r.action,
        refModel: null,
        cloudTier: r.cloudTierRaw,
        cloudBillingKind: r.cloudBillingKind,
        storedCostYuan: r.schemeAUnitCostYuan,
        storedPoints: r.pricePoints,
        inferredCostYuan: null,
        inferredBasis: "ToolBillablePrice.schemeARefModelKey 未配置",
        diffYuan: null,
        multiplier: r.schemeAAdminRetailMultiplier,
        inferredPoints: null,
        unitLabel: "",
        reason: "MISSING_REFMODEL",
      });
      continue;
    }
    const cands = linesByModel.get(r.schemeARefModelKey) ?? [];
    if (cands.length === 0) {
      out.push({
        billableId: r.id,
        toolKey: r.toolKey,
        action: r.action,
        refModel: r.schemeARefModelKey,
        cloudTier: r.cloudTierRaw,
        cloudBillingKind: r.cloudBillingKind,
        storedCostYuan: r.schemeAUnitCostYuan,
        storedPoints: r.pricePoints,
        inferredCostYuan: null,
        inferredBasis: "当前价目源中没有同名 modelKey",
        diffYuan: null,
        multiplier: r.schemeAAdminRetailMultiplier,
        inferredPoints: null,
        unitLabel: "",
        reason: "MISSING_SOURCE_LINE",
      });
      continue;
    }
    const line = cands[0]!;
    const { yuan: inferred, basis, unitLabel } = inferCostFromSourceLine(line, r.cloudTierRaw);
    const mult = r.schemeAAdminRetailMultiplier ?? null;
    const inferredPoints =
      inferred != null && mult != null && mult > 0
        ? Math.max(1, Math.round(inferred * mult * 100))
        : null;
    out.push({
      billableId: r.id,
      toolKey: r.toolKey,
      action: r.action,
      refModel: r.schemeARefModelKey,
      cloudTier: r.cloudTierRaw,
      cloudBillingKind: r.cloudBillingKind,
      storedCostYuan: r.schemeAUnitCostYuan,
      storedPoints: r.pricePoints,
      inferredCostYuan: inferred != null ? Number(inferred.toFixed(6)) : null,
      inferredBasis: basis,
      diffYuan:
        inferred != null && r.schemeAUnitCostYuan != null
          ? Number((r.schemeAUnitCostYuan - inferred).toFixed(6))
          : null,
      multiplier: mult,
      inferredPoints,
      unitLabel,
    });
  }

  /** 真正可自动核对的漂移：必须 inferredCostYuan 非 null（即源给出了可比较单价）。 */
  const drifts = out.filter(
    (r) =>
      r.inferredCostYuan != null &&
      r.diffYuan != null &&
      Math.abs(r.diffYuan) > COST_AUDIT_THRESHOLD_YUAN,
  );
  const skippedNoSource = out.filter((r) => r.inferredCostYuan == null);

  const outPath = path.join(
    "config",
    "generated",
    "pricing-audit-billable-vs-source.json",
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        sourceVersionId: currentVersion.id,
        sourceImportedAt: currentVersion.importedAt,
        thresholdYuan: COST_AUDIT_THRESHOLD_YUAN,
        totalRows: out.length,
        driftRows: drifts.length,
        rows: out,
      },
      null,
      2,
    ),
  );

  console.log("=== 工具站价格逐行核查（以 PricingSourceLine 为真）===");
  console.log(`版本：${currentVersion.id} · 导入于 ${currentVersion.importedAt.toISOString()}`);
  console.log(
    `阈值：${COST_AUDIT_THRESHOLD_YUAN} 元；总行数=${out.length}；可自动核对 ${out.length - skippedNoSource.length}；漂移=${drifts.length}；无源单价(跳过) ${skippedNoSource.length}`,
  );
  console.log("");
  console.log(
    "| toolKey | action | refModel | tier | stored cost | inferred cost | Δ (yuan) | M | stored pts | inferred pts | basis |",
  );
  console.log(
    "|---------|--------|----------|------|-------------|----------------|----------|---|------------|---------------|-------|",
  );
  for (const r of out) {
    console.log(
      `| ${r.toolKey} | ${r.action ?? "(*)"} | ${r.refModel ?? "—"} | ${r.cloudTier ?? "—"} | ${
        r.storedCostYuan != null ? r.storedCostYuan.toFixed(4) : "—"
      } | ${r.inferredCostYuan != null ? r.inferredCostYuan.toFixed(4) : "—"} | ${
        r.diffYuan != null ? r.diffYuan.toFixed(4) : "—"
      } | ${r.multiplier ?? "—"} | ${r.storedPoints} | ${
        r.inferredPoints ?? "—"
      } | ${r.inferredBasis} |`,
    );
  }

  if (drifts.length > 0) {
    console.log("");
    console.log(`⚠️  ${drifts.length} 行漂移 > ¥${COST_AUDIT_THRESHOLD_YUAN}，请运营在「定价管理」复核：`);
    for (const d of drifts) {
      console.log(
        `  - ${d.toolKey}/${d.action ?? "*"}/${d.refModel} : stored ${d.storedCostYuan?.toFixed(4)} vs inferred ${d.inferredCostYuan?.toFixed(4)} (Δ ${d.diffYuan?.toFixed(4)} 元)`,
      );
    }
    process.exit(3);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
