/** 对账总表用量分类：视频 / 图片 / 其他 */
export type MasterUsageCategory = "video" | "image" | "other";

export function categorizeReconciliationUnitKind(unitKind: string): MasterUsageCategory {
  switch (unitKind) {
    case "SEC":
      return "video";
    case "IMAGE":
      return "image";
    default:
      return "other";
  }
}

export function unitLabelForReconciliationUnitKind(unitKind: string): string {
  switch (unitKind) {
    case "SEC":
      return "秒";
    case "IMAGE":
      return "张";
    case "KTOKEN":
      return "千Token";
    case "AUDIO_SEC":
      return "音频秒";
    case "CHAR_10K":
      return "万字";
    case "CALL":
      return "次";
    default:
      return "单位";
  }
}

export type MasterUsageBucket = {
  category: MasterUsageCategory;
  label: string;
  platformUnits: number;
  unitLabel: string;
  platformListYuan: number;
  platformCredits: number;
  lineCount: number;
};

export type MasterUsageSummary = {
  buckets: MasterUsageBucket[];
  /** 各分类 platformUnits 不可直接相加（单位不同），仅展示分桶 */
  totalPlatformCredits: number;
  totalPlatformRevenueYuan: number;
};

type UsageRow = {
  unitKind: string;
  platformUnits: unknown;
  platformListYuan: unknown;
  platformCredits: number | null;
};

export function buildMasterUsageSummary(rows: UsageRow[]): MasterUsageSummary {
  const bucketMap: Record<
    MasterUsageCategory,
    MasterUsageBucket & { unitKinds: Set<string> }
  > = {
    video: {
      category: "video",
      label: "视频",
      platformUnits: 0,
      unitLabel: "秒",
      platformListYuan: 0,
      platformCredits: 0,
      lineCount: 0,
      unitKinds: new Set(["SEC"]),
    },
    image: {
      category: "image",
      label: "图片",
      platformUnits: 0,
      unitLabel: "张",
      platformListYuan: 0,
      platformCredits: 0,
      lineCount: 0,
      unitKinds: new Set(["IMAGE"]),
    },
    other: {
      category: "other",
      label: "其他",
      platformUnits: 0,
      unitLabel: "混合",
      platformListYuan: 0,
      platformCredits: 0,
      lineCount: 0,
      unitKinds: new Set(),
    },
  };

  let totalPlatformCredits = 0;
  let totalPlatformRevenueYuan = 0;

  for (const row of rows) {
    const unitKind = row.unitKind || "CALL";
    const category = categorizeReconciliationUnitKind(unitKind);
    const bucket = bucketMap[category];
    const units = num(row.platformUnits);
    const listYuan = num(row.platformListYuan);
    const credits = row.platformCredits ?? 0;

    bucket.platformUnits += units;
    bucket.platformListYuan += listYuan;
    bucket.platformCredits += credits;
    bucket.lineCount += 1;
    if (category === "other") bucket.unitKinds.add(unitKind);

    totalPlatformCredits += credits;
  }

  for (const bucket of Object.values(bucketMap)) {
    bucket.platformUnits = round2(bucket.platformUnits);
    bucket.platformListYuan = round4(bucket.platformListYuan);
    bucket.platformCredits = Math.round(bucket.platformCredits);
    if (bucket.category === "other" && bucket.unitKinds.size === 1) {
      const only = [...bucket.unitKinds][0]!;
      bucket.unitLabel = unitLabelForReconciliationUnitKind(only);
    }
  }

  return {
    buckets: [
      bucketMap.video,
      bucketMap.image,
      bucketMap.other,
    ].map(({ unitKinds: _, ...b }) => b),
    totalPlatformCredits: Math.round(totalPlatformCredits),
    totalPlatformRevenueYuan: round4(totalPlatformRevenueYuan),
  };
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
