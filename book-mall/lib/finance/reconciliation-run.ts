/**
 * v002 P5：「上传 CSV → 自动对账 → 入库 Run/Line」一体化逻辑（API 与脚本共用）。
 *
 * 流程：
 *   1) 解析 CSV（csv-parse）；
 *   2) 按「资源购买账号ID」分组；查 CloudAccountBinding 映射到平台 userId；
 *      未绑定的账号入 `unboundCloudAccounts` 列表，API 让管理员手动绑定后重跑。
 *   3) 对已绑定的账号：把 CSV 行写入 ToolBillingDetailLine (CLOUD_CSV_IMPORT)，幂等地基于 `标识信息/账单明细ID`；
 *      重复行跳过（按云行明细 ID 不会重复入库）。
 *   4) 对每个 (userId, month, modelKey, billingKind) 做 join：和该用户已有的
 *      TOOL_USAGE_GENERATED 行汇总比较；输出 BillingReconciliationLine。
 *   5) 写 BillingReconciliationRun 与对应 lines；返回 runId + summary。
 */
import { createHash } from "node:crypto";
import { parse as parseCsv } from "csv-parse/sync";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeInternalPricingWithTemplate,
  prismaDataFromInternalSnapshot,
} from "@/lib/finance/cloud-bill-enrich";
import { DEFAULT_PRICING_TEMPLATE_KEY } from "@/lib/finance/pricing-templates/keys";

type CsvRow = Record<string, string>;

export type ReconciliationUnboundAccount = {
  cloudAccountId: string;
  cloudAccountName: string | null;
  csvRowCount: number;
  payableYuanSum: number;
};

export type ReconciliationLineDTO = {
  userId: string | null;
  cloudAccountId: string | null;
  modelKey: string;
  billingKind: string;
  internalCount: number;
  internalYuan: number;
  cloudCount: number;
  cloudPayableYuan: number;
  diffYuan: number;
  matchKind: "BOTH" | "INTERNAL_ONLY" | "CLOUD_ONLY" | "UNBOUND";
};

export type ReconciliationRunResult = {
  runId: string;
  summary: {
    csvRowCount: number;
    importedCloudLines: number;
    skippedExistingCloudLines: number;
    monthsCovered: string[];
    boundUsers: number;
    unboundCloudAccounts: ReconciliationUnboundAccount[];
    internalLineCount: number;
    cloudLineCount: number;
    internalTotalYuan: number;
    cloudTotalPayableYuan: number;
    diffYuanInternalMinusCloud: number;
    verdict: "PLATFORM_OK" | "PLATFORM_DEFICIT" | "MIXED";
  };
  lines: ReconciliationLineDTO[];
};

function parseFloatLoose(s: string | undefined): number {
  if (s == null) return 0;
  const n = parseFloat(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function modelKeyFromCloudRow(row: CsvRow): string {
  const spec = row["产品信息/规格"]?.trim();
  if (spec) return spec;
  const sel = row["产品信息/选型配置"]?.trim() ?? "";
  const parts = sel.split(";").map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    if (
      p.startsWith("happyhorse") ||
      p.startsWith("qwen") ||
      p.startsWith("wan") ||
      p.startsWith("pixverse")
    ) {
      return p;
    }
  }
  return (
    row["产品信息/计费项Code"]?.trim() ||
    row["产品信息/产品Code"]?.trim() ||
    "(unknown)"
  );
}

function billingKindFromRow(row: CsvRow): string {
  const unit = (row["用量信息/用量单位"] || "").trim();
  if (unit === "秒") return "VIDEO_MODEL_SPEC";
  if (unit === "张") return "OUTPUT_IMAGE";
  if (unit === "次") return "COST_PER_IMAGE";
  if (unit.toLowerCase().includes("token")) return "TOKEN_IN_OUT";
  return unit || "(unknown)";
}

function cloudRowFromBillingLine(json: unknown): CsvRow {
  if (json == null) return {};
  if (typeof json === "string") {
    try {
      return cloudRowFromBillingLine(JSON.parse(json));
    } catch {
      return {};
    }
  }
  if (typeof json !== "object" || Array.isArray(json)) return {};
  const out: CsvRow = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    out[k] = v == null ? "" : String(v);
  }
  return out;
}

export type RunReconciliationOpts = {
  csvText: string;
  csvFilename: string;
  importedByUserId: string;
  /** 若该 CSV 已被同 sha256 上传过：true=报错；false=返回已有 runId */
  rejectDuplicate?: boolean;
};

export async function runReconciliationFromCsv(opts: RunReconciliationOpts): Promise<ReconciliationRunResult> {
  const sha = createHash("sha256").update(opts.csvText).digest("hex");

  if (!opts.rejectDuplicate) {
    const existing = await prisma.billingReconciliationRun.findUnique({
      where: { csvSha256: sha },
      include: { lines: true },
    });
    if (existing) {
      return convertExistingRun(existing);
    }
  } else {
    const dup = await prisma.billingReconciliationRun.findUnique({
      where: { csvSha256: sha },
      select: { id: true },
    });
    if (dup) throw new Error(`该 CSV 已上传过：runId=${dup.id}`);
  }

  const records = parseCsv(opts.csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  }) as CsvRow[];

  const monthsSet = new Set<string>();
  const byCloudAccount = new Map<string, { rows: CsvRow[]; name: string | null }>();
  for (const r of records) {
    const cid = r["身份信息/资源购买账号ID"]?.trim();
    if (!cid) continue;
    const m = r["账单信息/账单月份"]?.trim();
    if (m) monthsSet.add(m);
    const cur = byCloudAccount.get(cid) ?? {
      rows: [],
      name: r["身份信息/资源购买账号"]?.trim() || null,
    };
    cur.rows.push(r);
    byCloudAccount.set(cid, cur);
  }

  const bindings = await prisma.cloudAccountBinding.findMany({
    where: { cloudAccountId: { in: Array.from(byCloudAccount.keys()) } },
    select: { cloudAccountId: true, userId: true },
  });
  const bindingMap = new Map(bindings.map((b) => [b.cloudAccountId, b.userId]));

  const unbound: ReconciliationUnboundAccount[] = [];
  const boundEntries: Array<{
    cloudAccountId: string;
    userId: string;
    rows: CsvRow[];
  }> = [];
  for (const [cid, { rows, name }] of byCloudAccount.entries()) {
    const uid = bindingMap.get(cid);
    if (!uid) {
      unbound.push({
        cloudAccountId: cid,
        cloudAccountName: name,
        csvRowCount: rows.length,
        payableYuanSum: rows.reduce(
          (s, r) => s + parseFloatLoose(r["应付信息/应付金额（含税）"]),
          0,
        ),
      });
    } else {
      boundEntries.push({ cloudAccountId: cid, userId: uid, rows });
    }
  }

  let importedCloudLines = 0;
  let skippedExistingCloudLines = 0;
  const capturedAt = new Date();
  const templateKey = DEFAULT_PRICING_TEMPLATE_KEY;

  for (const { userId, rows } of boundEntries) {
    const existingIds = await prisma.toolBillingDetailLine.findMany({
      where: {
        userId,
        source: "CLOUD_CSV_IMPORT",
      },
      select: { cloudRow: true },
    });
    const existingSet = new Set<string>();
    for (const e of existingIds) {
      const id = cloudRowFromBillingLine(e.cloudRow as unknown)["标识信息/账单明细ID"];
      if (id) existingSet.add(id);
    }

    const fresh: Prisma.ToolBillingDetailLineCreateManyInput[] = [];
    for (const r of rows) {
      const id = r["标识信息/账单明细ID"]?.trim();
      if (id && existingSet.has(id)) {
        skippedExistingCloudLines += 1;
        continue;
      }
      const snap = computeInternalPricingWithTemplate(r, templateKey);
      const internal = prismaDataFromInternalSnapshot(snap, capturedAt);
      fresh.push({
        userId,
        source: "CLOUD_CSV_IMPORT",
        cloudRow: r as unknown as Prisma.InputJsonValue,
        pricingTemplateKey: templateKey,
        ...internal,
      });
    }
    if (fresh.length > 0) {
      const ins = await prisma.toolBillingDetailLine.createMany({ data: fresh });
      importedCloudLines += ins.count;
    }
  }

  type AggKey = string;
  const agg = new Map<
    AggKey,
    Omit<ReconciliationLineDTO, "diffYuan" | "matchKind"> & {
      diffYuan?: number;
      matchKind?: ReconciliationLineDTO["matchKind"];
    }
  >();
  function pushAgg(key: AggKey, init: () => ReconciliationLineDTO): ReconciliationLineDTO {
    const exists = agg.get(key);
    if (exists) return exists as ReconciliationLineDTO;
    const seed = init();
    agg.set(key, seed);
    return seed;
  }
  const months = Array.from(monthsSet).sort();

  for (const { userId, cloudAccountId } of boundEntries) {
    const lines = await prisma.toolBillingDetailLine.findMany({
      where: { userId },
      select: {
        source: true,
        cloudRow: true,
        internalChargedPoints: true,
        internalYuanReference: true,
      },
    });
    for (const l of lines) {
      const row = cloudRowFromBillingLine(l.cloudRow as unknown);
      const m = row["账单信息/账单月份"];
      if (m && months.length > 0 && !months.includes(m)) continue;
      const modelKey = modelKeyFromCloudRow(row);
      const billingKind = billingKindFromRow(row);
      const k = `${userId}::${modelKey}::${billingKind}`;
      const entry = pushAgg(k, () => ({
        userId,
        cloudAccountId,
        modelKey,
        billingKind,
        internalCount: 0,
        internalYuan: 0,
        cloudCount: 0,
        cloudPayableYuan: 0,
        diffYuan: 0,
        matchKind: "BOTH",
      }));
      if (l.source === "TOOL_USAGE_GENERATED") {
        const yuan = l.internalYuanReference
          ? Number(l.internalYuanReference)
          : (l.internalChargedPoints ?? 0) / 100;
        entry.internalCount += 1;
        entry.internalYuan += yuan;
      } else if (l.source === "CLOUD_CSV_IMPORT") {
        entry.cloudCount += 1;
        entry.cloudPayableYuan += parseFloatLoose(row["应付信息/应付金额（含税）"]);
      }
    }
  }

  for (const u of unbound) {
    let modelKey = "(unbound)";
    let billingKind = "(mixed)";
    const sample =
      byCloudAccount.get(u.cloudAccountId)?.rows?.[0];
    if (sample) {
      modelKey = modelKeyFromCloudRow(sample);
      billingKind = billingKindFromRow(sample);
    }
    const k = `unbound::${u.cloudAccountId}::${modelKey}::${billingKind}`;
    pushAgg(k, () => ({
      userId: null,
      cloudAccountId: u.cloudAccountId,
      modelKey,
      billingKind,
      internalCount: 0,
      internalYuan: 0,
      cloudCount: u.csvRowCount,
      cloudPayableYuan: u.payableYuanSum,
      diffYuan: -u.payableYuanSum,
      matchKind: "UNBOUND",
    }));
  }

  const linesOut: ReconciliationLineDTO[] = [];
  let internalTotal = 0;
  let cloudTotal = 0;
  let internalCount = 0;
  let cloudCount = 0;

  for (const g of agg.values()) {
    const diff = (g.internalYuan ?? 0) - (g.cloudPayableYuan ?? 0);
    let matchKind: ReconciliationLineDTO["matchKind"];
    if (g.matchKind === "UNBOUND") {
      matchKind = "UNBOUND";
    } else if (g.internalCount > 0 && g.cloudCount > 0) {
      matchKind = "BOTH";
    } else if (g.internalCount > 0) {
      matchKind = "INTERNAL_ONLY";
    } else if (g.cloudCount > 0) {
      matchKind = "CLOUD_ONLY";
    } else {
      continue;
    }
    linesOut.push({
      userId: g.userId,
      cloudAccountId: g.cloudAccountId,
      modelKey: g.modelKey,
      billingKind: g.billingKind,
      internalCount: g.internalCount,
      internalYuan: Number(g.internalYuan.toFixed(4)),
      cloudCount: g.cloudCount,
      cloudPayableYuan: Number(g.cloudPayableYuan.toFixed(4)),
      diffYuan: Number(diff.toFixed(4)),
      matchKind,
    });
    internalTotal += g.internalYuan;
    cloudTotal += g.cloudPayableYuan;
    internalCount += g.internalCount;
    cloudCount += g.cloudCount;
  }

  const overallDiff = internalTotal - cloudTotal;
  const verdict: "PLATFORM_OK" | "PLATFORM_DEFICIT" | "MIXED" =
    unbound.length > 0
      ? "MIXED"
      : overallDiff >= 0
        ? "PLATFORM_OK"
        : "PLATFORM_DEFICIT";

  const summary = {
    csvRowCount: records.length,
    importedCloudLines,
    skippedExistingCloudLines,
    monthsCovered: months,
    boundUsers: boundEntries.length,
    unboundCloudAccounts: unbound,
    internalLineCount: internalCount,
    cloudLineCount: cloudCount,
    internalTotalYuan: Number(internalTotal.toFixed(4)),
    cloudTotalPayableYuan: Number(cloudTotal.toFixed(4)),
    diffYuanInternalMinusCloud: Number(overallDiff.toFixed(4)),
    verdict,
  };

  const run = await prisma.billingReconciliationRun.create({
    data: {
      csvSha256: sha,
      csvFilename: opts.csvFilename.slice(0, 240),
      monthsCovered: months.join(","),
      importedByUserId: opts.importedByUserId,
      summary: summary as unknown as Prisma.InputJsonValue,
      status: "READY",
      lines: {
        create: linesOut.map((l) => ({
          userId: l.userId,
          cloudAccountId: l.cloudAccountId,
          modelKey: l.modelKey,
          billingKind: l.billingKind,
          internalCount: l.internalCount,
          internalYuan: new Prisma.Decimal(l.internalYuan.toFixed(4)),
          cloudCount: l.cloudCount,
          cloudPayableYuan: new Prisma.Decimal(l.cloudPayableYuan.toFixed(4)),
          diffYuan: new Prisma.Decimal(l.diffYuan.toFixed(4)),
          matchKind: l.matchKind,
        })),
      },
    },
  });

  return { runId: run.id, summary, lines: linesOut };
}

async function convertExistingRun(run: {
  id: string;
  summary: unknown;
  lines: Array<{
    userId: string | null;
    cloudAccountId: string | null;
    modelKey: string;
    billingKind: string;
    internalCount: number;
    internalYuan: unknown;
    cloudCount: number;
    cloudPayableYuan: unknown;
    diffYuan: unknown;
    matchKind: string;
  }>;
}): Promise<ReconciliationRunResult> {
  const summary = run.summary as ReconciliationRunResult["summary"];
  return {
    runId: run.id,
    summary,
    lines: run.lines.map((l) => ({
      userId: l.userId,
      cloudAccountId: l.cloudAccountId,
      modelKey: l.modelKey,
      billingKind: l.billingKind,
      internalCount: l.internalCount,
      internalYuan: Number(l.internalYuan),
      cloudCount: l.cloudCount,
      cloudPayableYuan: Number(l.cloudPayableYuan),
      diffYuan: Number(l.diffYuan),
      matchKind: l.matchKind as ReconciliationLineDTO["matchKind"],
    })),
  };
}
