/**
 * BYOK 定价标准（财务 2.0）
 *
 * 两档月费：个人 ¥39/月；团队 ¥29/席/月（3 席起）。
 * 套餐内含月度任务额度；超出后从轻量包（通用积分池）按次扣固定积分。
 *
 * 超额扣分测算口径（锚定 ¥0.04/积分）：
 * - 文生图 20 积分/次 ≈ ¥0.80 — 覆盖调度(¥0.01)+临时存储+出网，目标平台侧毛利 ≥60%
 * - 图生视频 80 积分/次 ≈ ¥3.20 — 15s 任务编排、预览缓存、队列（不含厂商费）
 * - 视频生视频 100 积分/次 ≈ ¥4.00 — 较图生视频多一轮素材读写与转码
 */
import type { ByokTaskKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { DEFAULT_CREDIT_ANCHOR_YUAN } from "@/lib/pricing/credit-pricing-formulas";
import { CREDIT_TOPUP_PACKS } from "@/lib/billing/credit-topup-packs";

export const BYOK_SCOPE_PERSONAL = "personal";
export const BYOK_SCOPE_TEAM_SEAT = "team-seat";
export const BYOK_TEAM_MIN_SEATS = 3;

export const BYOK_TASK_KIND_LABEL: Record<ByokTaskKind, string> = {
  TEXT_TO_IMAGE: "文生图",
  IMAGE_TO_VIDEO: "图生视频",
  VIDEO_TO_VIDEO: "视频生视频",
};

/** 将 Gateway 日志映射为 BYOK 任务类型（报表与结算共用）。 */
export function mapLogToByokTaskKind(log: {
  requestKind: string;
  inputSummary?: unknown;
}): ByokTaskKind | null {
  if (log.requestKind === "IMAGE" || log.requestKind === "CHAT") return "TEXT_TO_IMAGE";
  if (log.requestKind === "VIDEO") {
    const s =
      log.inputSummary && typeof log.inputSummary === "object" && !Array.isArray(log.inputSummary)
        ? (log.inputSummary as Record<string, unknown>)
        : null;
    if (s?.sourceVideo || s?.videoUrl || s?.referenceVideo || s?.mode === "v2v" || s?.taskType === "video2video") {
      return "VIDEO_TO_VIDEO";
    }
    return "IMAGE_TO_VIDEO";
  }
  return null;
}

/** 平台侧单次基础设施成本估算（元，不含用户自付厂商费） */
export const BYOK_PLATFORM_COST_ESTIMATE_YUAN: Record<ByokTaskKind, number> = {
  TEXT_TO_IMAGE: 0.08,
  IMAGE_TO_VIDEO: 0.28,
  VIDEO_TO_VIDEO: 0.36,
};

export interface ByokQuotaSeed {
  scopeKey: string;
  taskKind: ByokTaskKind;
  label: string;
  monthlyIncluded: number;
  overageCredits: number;
}

export const DEFAULT_BYOK_CONFIGS = [
  {
    scopeKey: BYOK_SCOPE_PERSONAL,
    label: "个人 BYOK",
    techServiceFeeYuan: 39,
    minSeats: null as number | null,
    note: "已有厂商 Key；模型费自理，平台收技术服务费 + 套餐内额度",
  },
  {
    scopeKey: BYOK_SCOPE_TEAM_SEAT,
    label: "团队 BYOK（每席位）",
    techServiceFeeYuan: 29,
    minSeats: BYOK_TEAM_MIN_SEATS,
    note: `${BYOK_TEAM_MIN_SEATS} 席起订；每席独立额度，团队共享轻量包余额`,
  },
] as const;

/** 个人 / 团队（每席）默认月度额度 */
export const DEFAULT_BYOK_QUOTAS: ByokQuotaSeed[] = [
  { scopeKey: BYOK_SCOPE_PERSONAL, taskKind: "TEXT_TO_IMAGE", label: "文生图", monthlyIncluded: 100, overageCredits: 20 },
  { scopeKey: BYOK_SCOPE_PERSONAL, taskKind: "IMAGE_TO_VIDEO", label: "图生视频", monthlyIncluded: 20, overageCredits: 80 },
  { scopeKey: BYOK_SCOPE_PERSONAL, taskKind: "VIDEO_TO_VIDEO", label: "视频生视频", monthlyIncluded: 10, overageCredits: 100 },
  { scopeKey: BYOK_SCOPE_TEAM_SEAT, taskKind: "TEXT_TO_IMAGE", label: "文生图", monthlyIncluded: 80, overageCredits: 20 },
  { scopeKey: BYOK_SCOPE_TEAM_SEAT, taskKind: "IMAGE_TO_VIDEO", label: "图生视频", monthlyIncluded: 15, overageCredits: 80 },
  { scopeKey: BYOK_SCOPE_TEAM_SEAT, taskKind: "VIDEO_TO_VIDEO", label: "视频生视频", monthlyIncluded: 8, overageCredits: 100 },
];

const LEGACY_BYOK_SCOPES = ["personal-standard", "personal-pro", "team-base"];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

export type ByokUsageScenario = {
  label: string;
  description: string;
  techFeeYuan: number;
  overageCredits: number;
  overageRevenueYuan: number;
  platformCostYuan: number;
  profitYuan: number;
  marginRate: number;
};

export function simulateByokMonth(input: {
  scopeKey: string;
  techServiceFeeYuan: number;
  seats?: number;
  quotas: { taskKind: ByokTaskKind; monthlyIncluded: number; overageCredits: number }[];
  usage: Partial<Record<ByokTaskKind, number>>;
}): ByokUsageScenario {
  const seats = Math.max(1, input.seats ?? 1);
  const techFeeYuan = round2(
    input.scopeKey === BYOK_SCOPE_TEAM_SEAT
      ? input.techServiceFeeYuan * seats
      : input.techServiceFeeYuan,
  );

  let overageCredits = 0;
  let platformCostYuan = 0;

  for (const q of input.quotas) {
    const used = Math.max(0, input.usage[q.taskKind] ?? 0);
    const included = q.monthlyIncluded * (input.scopeKey === BYOK_SCOPE_TEAM_SEAT ? seats : 1);
    const over = Math.max(0, used - included);
    overageCredits += over * q.overageCredits;
    platformCostYuan += used * BYOK_PLATFORM_COST_ESTIMATE_YUAN[q.taskKind];
  }

  const overageRevenueYuan = round2(overageCredits * DEFAULT_CREDIT_ANCHOR_YUAN);
  const totalRevenueYuan = round2(techFeeYuan + overageRevenueYuan);
  const profitYuan = round2(totalRevenueYuan - platformCostYuan);
  const marginRate = totalRevenueYuan > 0 ? round4(profitYuan / totalRevenueYuan) : 0;

  return {
    label: "",
    description: "",
    techFeeYuan,
    overageCredits,
    overageRevenueYuan,
    platformCostYuan: round2(platformCostYuan),
    profitYuan,
    marginRate,
  };
}

export function buildByokPricingStandards() {
  const lightPack = CREDIT_TOPUP_PACKS[0];
  return {
    anchorYuan: DEFAULT_CREDIT_ANCHOR_YUAN,
    lightPack: {
      label: lightPack.label,
      credits: lightPack.credits,
      priceYuan: lightPack.priceYuan,
    },
    platformCostEstimateYuan: BYOK_PLATFORM_COST_ESTIMATE_YUAN,
    overageRationale: [
      {
        taskKind: "TEXT_TO_IMAGE" as const,
        credits: 20,
        yuan: round2(20 * DEFAULT_CREDIT_ANCHOR_YUAN),
        note: "调度 + 临时存储 + 出网；厂商生图费用户自理",
      },
      {
        taskKind: "IMAGE_TO_VIDEO" as const,
        credits: 80,
        yuan: round2(80 * DEFAULT_CREDIT_ANCHOR_YUAN),
        note: "15s 视频任务编排、预览缓存、队列；厂商视频费用户自理",
      },
      {
        taskKind: "VIDEO_TO_VIDEO" as const,
        credits: 100,
        yuan: round2(100 * DEFAULT_CREDIT_ANCHOR_YUAN),
        note: "双视频素材读写与转码；厂商费用户自理",
      },
    ],
  };
}

export async function buildByokFinanceReport(periodKey: string) {
  const since = new Date(`${periodKey}-01T00:00:00.000Z`);
  const until = new Date(since);
  until.setUTCMonth(until.getUTCMonth() + 1);

  const [configs, quotas, rates, resourceEvents, gatewayLogs, usageRows] = await Promise.all([
    prisma.byokServiceConfig.findMany({ where: { active: true }, orderBy: { scopeKey: "asc" } }),
    prisma.byokTaskQuota.findMany({ where: { active: true }, orderBy: [{ scopeKey: "asc" }, { taskKind: "asc" }] }),
    prisma.resourceMeterRate.findMany({ where: { active: true } }),
    prisma.resourceMeterEvent.findMany({
      where: { periodKey, createdAt: { gte: since, lt: until } },
      select: { resourceType: true, quantity: true, costYuan: true },
    }),
    prisma.gatewayRequestLog.findMany({
      where: {
        billingMode: "BYOK",
        status: "SUCCEEDED",
        createdAt: { gte: since, lt: until },
      },
      select: {
        requestKind: true,
        inputSummary: true,
        estimatedVendorCostYuan: true,
        creditsCharged: true,
      },
    }),
    prisma.byokUsageMonthly.findMany({
      where: { periodKey },
      orderBy: [{ ownerType: "asc" }, { ownerId: "asc" }, { taskKind: "asc" }],
    }),
  ]);

  let resourceFeeYuan = 0;
  const resourceByType: Record<string, { quantity: number; costYuan: number }> = {};
  for (const e of resourceEvents) {
    const cost = Number(e.costYuan);
    resourceFeeYuan += cost;
    const key = e.resourceType;
    resourceByType[key] ??= { quantity: 0, costYuan: 0 };
    resourceByType[key].quantity += Number(e.quantity);
    resourceByType[key].costYuan += cost;
  }

  let vendorCostObservedYuan = 0;
  const taskObserved: Record<string, number> = {
    TEXT_TO_IMAGE: 0,
    IMAGE_TO_VIDEO: 0,
    VIDEO_TO_VIDEO: 0,
    OTHER: 0,
  };
  for (const log of gatewayLogs) {
    vendorCostObservedYuan += log.estimatedVendorCostYuan != null ? Number(log.estimatedVendorCostYuan) : 0;
    const kind = mapLogToByokTaskKind(log);
    if (kind) taskObserved[kind] += 1;
    else taskObserved.OTHER += 1;
  }

  const ownerKeys = [...new Set(usageRows.map((r) => `${r.ownerType}:${r.ownerId}`))];
  const userIds = usageRows.filter((r) => r.ownerType === "USER").map((r) => r.ownerId);
  const tenantIds = usageRows.filter((r) => r.ownerType === "TENANT").map((r) => r.ownerId);
  const [users, tenants, accounts] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : Promise.resolve([]),
    tenantIds.length
      ? prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true, type: true } })
      : Promise.resolve([]),
    ownerKeys.length
      ? prisma.creditAccount.findMany({
          where: {
            OR: usageRows.map((r) => ({ ownerType: r.ownerType, ownerId: r.ownerId })),
          },
          select: { ownerType: true, ownerId: true, balanceCredits: true },
        })
      : Promise.resolve([]),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const tenantMap = new Map(tenants.map((t) => [t.id, t]));
  const accountMap = new Map(accounts.map((a) => [`${a.ownerType}:${a.ownerId}`, a]));

  const ownerUsage = ownerKeys.map((key) => {
    const [ownerType, ownerId] = key.split(":");
    const rows = usageRows.filter((r) => r.ownerType === ownerType && r.ownerId === ownerId);
    const scopeKey = rows[0]?.scopeKey ?? BYOK_SCOPE_PERSONAL;
    const seats = rows[0]?.seatsSnapshot ?? 1;
    const label =
      ownerType === "TENANT"
        ? `团队 · ${tenantMap.get(ownerId)?.name ?? ownerId}`
        : `个人 · ${userMap.get(ownerId)?.name ?? userMap.get(ownerId)?.email ?? ownerId}`;
    const account = accountMap.get(key);
    const tasks = rows.map((r) => ({
      taskKind: r.taskKind,
      label: BYOK_TASK_KIND_LABEL[r.taskKind],
      includedUsed: r.includedUsed,
      overageUsed: r.overageUsed,
      overageCredits: r.overageCredits,
      quota: quotas.find((q) => q.scopeKey === scopeKey && q.taskKind === r.taskKind)?.monthlyIncluded ?? 0,
    }));
    return {
      ownerType,
      ownerId,
      scopeKey,
      seats,
      label,
      audience: ownerType === "TENANT" ? "团队" : "个人",
      balanceCredits: account?.balanceCredits ?? 0,
      totalOverageCredits: rows.reduce((s, r) => s + r.overageCredits, 0),
      tasks,
    };
  });

  const standards = buildByokPricingStandards();

  const simulationScenarios = configs.flatMap((cfg) => {
    const scopeQuotas = quotas
      .filter((q) => q.scopeKey === cfg.scopeKey)
      .map((q) => ({
        taskKind: q.taskKind,
        monthlyIncluded: q.monthlyIncluded,
        overageCredits: q.overageCredits,
      }));
    const fee = Number(cfg.techServiceFeeYuan);
    const seats = cfg.scopeKey === BYOK_SCOPE_TEAM_SEAT ? BYOK_TEAM_MIN_SEATS : 1;

    const within = simulateByokMonth({
      scopeKey: cfg.scopeKey,
      techServiceFeeYuan: fee,
      seats,
      quotas: scopeQuotas,
      usage: {
        TEXT_TO_IMAGE: scopeQuotas.find((q) => q.taskKind === "TEXT_TO_IMAGE")?.monthlyIncluded ?? 0,
        IMAGE_TO_VIDEO: scopeQuotas.find((q) => q.taskKind === "IMAGE_TO_VIDEO")?.monthlyIncluded ?? 0,
        VIDEO_TO_VIDEO: scopeQuotas.find((q) => q.taskKind === "VIDEO_TO_VIDEO")?.monthlyIncluded ?? 0,
      },
    });

    const exceed = simulateByokMonth({
      scopeKey: cfg.scopeKey,
      techServiceFeeYuan: fee,
      seats,
      quotas: scopeQuotas,
      usage: {
        TEXT_TO_IMAGE: (scopeQuotas.find((q) => q.taskKind === "TEXT_TO_IMAGE")?.monthlyIncluded ?? 0) + 30,
        IMAGE_TO_VIDEO: (scopeQuotas.find((q) => q.taskKind === "IMAGE_TO_VIDEO")?.monthlyIncluded ?? 0) + 10,
        VIDEO_TO_VIDEO: (scopeQuotas.find((q) => q.taskKind === "VIDEO_TO_VIDEO")?.monthlyIncluded ?? 0) + 5,
      },
    });

    return [
      {
        ...within,
        scopeKey: cfg.scopeKey,
        label: cfg.label,
        scenario: "套餐内用满（无超额）",
        description: cfg.scopeKey === BYOK_SCOPE_TEAM_SEAT ? `${seats} 席 × 各任务额度` : "个人各任务额度用满",
      },
      {
        ...exceed,
        scopeKey: cfg.scopeKey,
        label: cfg.label,
        scenario: "超出额度（需轻量包）",
        description: "文生图 +30、图生视频 +10、视频生视频 +5 次超额示例",
      },
    ];
  });

  return {
    periodKey,
    standards,
    configs: configs.map((c) => ({
      id: c.id,
      scopeKey: c.scopeKey,
      label: c.label,
      techServiceFeeYuan: Number(c.techServiceFeeYuan),
      minSeats: c.minSeats,
      interval: c.interval,
      note: c.note,
      active: c.active,
    })),
    quotas: quotas.map((q) => ({
      id: q.id,
      scopeKey: q.scopeKey,
      taskKind: q.taskKind,
      label: q.label,
      monthlyIncluded: q.monthlyIncluded,
      overageCredits: q.overageCredits,
      overageYuan: round2(q.overageCredits * DEFAULT_CREDIT_ANCHOR_YUAN),
      active: q.active,
    })),
    rates: rates.map((r) => ({
      resourceType: r.resourceType,
      coefficientYuan: Number(r.coefficientYuan),
      unitLabel: r.unitLabel,
    })),
    observed: {
      gatewayTaskCount: gatewayLogs.length,
      overageCreditsTotal: gatewayLogs.reduce((s, l) => s + (l.creditsCharged ?? 0), 0),
      vendorCostYuan: round2(vendorCostObservedYuan),
      taskByKind: taskObserved,
      resourceFeeYuan: round2(resourceFeeYuan),
      resourceByType,
      note: "厂商成本为用户自付观测值；平台收入 = 技术服务费 + 超额轻量包扣分 + 资源计量费",
    },
    ownerUsage,
    simulationScenarios,
  };
}

export async function seedByokSimplifiedPricing() {
  for (const cfg of DEFAULT_BYOK_CONFIGS) {
    await prisma.byokServiceConfig.upsert({
      where: { scopeKey: cfg.scopeKey },
      create: {
        scopeKey: cfg.scopeKey,
        label: cfg.label,
        techServiceFeeYuan: cfg.techServiceFeeYuan,
        minSeats: cfg.minSeats,
        interval: "MONTH",
        note: cfg.note,
        active: true,
      },
      update: {
        label: cfg.label,
        techServiceFeeYuan: cfg.techServiceFeeYuan,
        minSeats: cfg.minSeats,
        note: cfg.note,
        active: true,
      },
    });
  }

  for (const legacy of LEGACY_BYOK_SCOPES) {
    await prisma.byokServiceConfig.updateMany({
      where: { scopeKey: legacy },
      data: { active: false },
    });
  }

  for (const q of DEFAULT_BYOK_QUOTAS) {
    await prisma.byokTaskQuota.upsert({
      where: { scopeKey_taskKind: { scopeKey: q.scopeKey, taskKind: q.taskKind } },
      create: {
        scopeKey: q.scopeKey,
        taskKind: q.taskKind,
        label: q.label,
        monthlyIncluded: q.monthlyIncluded,
        overageCredits: q.overageCredits,
        active: true,
      },
      update: {
        label: q.label,
        monthlyIncluded: q.monthlyIncluded,
        overageCredits: q.overageCredits,
        active: true,
      },
    });
  }
}
