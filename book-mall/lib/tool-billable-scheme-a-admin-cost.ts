/**
 * 工具管理「按次单价」：从主站当前价目 + tool-web sync map 解析方案 A 模型与默认单位成本（元）。
 */
import * as fs from "fs";
import * as path from "path";
import type { PrismaClient, PricingBillingKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SchemeAModelOption } from "./tool-billable-scheme-a-shared";
import { schemeABillableOptionsKey } from "./tool-billable-scheme-a-shared";

export type { SchemeAModelOption } from "./tool-billable-scheme-a-shared";
export { schemeABillableOptionsKey } from "./tool-billable-scheme-a-shared";

type SyncMap = {
  visualLabAnalysis: {
    models: Array<{ catalogId: string; modelKey: string; tierRaw: string }>;
  };
  toolsSchemeA: {
    aiTryOn: Record<string, { modelKey: string; billingKind: PricingBillingKind }>;
    textToImage: Record<string, { modelKey: string; billingKind: PricingBillingKind }>;
    video: Record<string, { modelKey: string; billingKind: PricingBillingKind }>;
  };
};

type VisualCat = {
  defaultEquivalentInputMillion: number;
  defaultEquivalentOutputMillion: number;
  models: Array<{
    id: string;
    equivalentInputMillion?: number | null;
    equivalentOutputMillion?: number | null;
    tierNote?: string;
  }>;
};

function toolWebRoot(): string {
  return path.resolve(process.cwd(), "..", "tool-web");
}

function findLine(
  lines: Array<{
    billingKind: PricingBillingKind;
    modelKey: string;
    tierRaw: string;
    inputYuanPerMillion: number | null;
    outputYuanPerMillion: number | null;
    costJson: unknown;
  }>,
  kind: PricingBillingKind,
  modelKey: string,
  tierRaw: string,
) {
  return lines.find(
    (l) =>
      l.billingKind === kind &&
      l.modelKey === modelKey &&
      (tierRaw === "" ? l.tierRaw === "" || l.tierRaw === "—" : l.tierRaw === tierRaw),
  );
}

type SrKey = "480" | "720" | "1080";

function usageSrToBucket(sr: number): SrKey {
  if (!Number.isFinite(sr) || sr <= 0) return "720";
  if (sr <= 480) return "480";
  if (sr <= 720) return "720";
  return "1080";
}

function getVideoCostYuanPerSecond(opts: {
  spec: unknown;
  sr: number;
  audio: boolean;
}): number | null {
  const spec = opts.spec as Record<string, unknown> | null;
  if (!spec || typeof spec !== "object") return null;

  if ("flatYuanPerSecond" in spec) {
    const v = spec.flatYuanPerSecond;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  if ("bySr" in spec && spec.bySr && typeof spec.bySr === "object") {
    const bySr = spec.bySr as Record<string, number>;
    const bucket = usageSrToBucket(opts.sr);
    const rate = bySr[bucket];
    return typeof rate === "number" && Number.isFinite(rate) ? rate : null;
  }
  if ("bySrAudio" in spec && spec.bySrAudio && typeof spec.bySrAudio === "object") {
    const bySrAudio = spec.bySrAudio as Record<
      string,
      { true?: number; false?: number }
    >;
    const bucket = usageSrToBucket(opts.sr);
    const row = bySrAudio[bucket];
    if (!row) return null;
    const k = opts.audio ? "true" : "false";
    const r = row[k as "true"];
    return typeof r === "number" && Number.isFinite(r) ? r : null;
  }
  return null;
}

/** 与工具站 listToolsSchemeAPriceRows 一致：示例 5s·720P·有声 的总成本（元，未乘 M） */
function videoUnitCostYuanFromSpec(spec: unknown): number | null {
  const yps = getVideoCostYuanPerSecond({ spec, sr: 720, audio: true });
  if (yps == null || yps <= 0) return null;
  return yps * 5;
}

function visualEquivalentFor(
  vCat: VisualCat,
  catalogId: string,
): { inM: number; outM: number } {
  const m = vCat.models.find((x) => x.id === catalogId);
  const inM = m?.equivalentInputMillion ?? vCat.defaultEquivalentInputMillion;
  const outM = m?.equivalentOutputMillion ?? vCat.defaultEquivalentOutputMillion;
  return { inM, outM };
}

function visualUnitCostFromLine(
  row:
    | {
        inputYuanPerMillion: number | null;
        outputYuanPerMillion: number | null;
      }
    | undefined,
  inM: number,
  outM: number,
): number | null {
  if (
    !row ||
    row.inputYuanPerMillion == null ||
    row.outputYuanPerMillion == null
  )
    return null;
  return inM * row.inputYuanPerMillion + outM * row.outputYuanPerMillion;
}

export async function loadSchemeAModelCatalog(
  db: PrismaClient = prisma,
): Promise<{
  lines: Array<{
    billingKind: PricingBillingKind;
    modelKey: string;
    tierRaw: string;
    inputYuanPerMillion: number | null;
    outputYuanPerMillion: number | null;
    costJson: unknown;
  }>;
  optionsByKey: Record<string, SchemeAModelOption[]>;
}> {
  const current = await db.pricingSourceVersion.findFirst({
    where: { isCurrent: true },
    include: { lines: true },
  });
  const lines = current?.lines ?? [];

  const mapPath = path.join(toolWebRoot(), "config", "pricing-catalog-sync-map.json");
  const map = JSON.parse(fs.readFileSync(mapPath, "utf8")) as SyncMap;

  const visualPath = path.join(
    toolWebRoot(),
    "config",
    "visual-lab-analysis-scheme-a-catalog.json",
  );
  const vCat = JSON.parse(fs.readFileSync(visualPath, "utf8")) as VisualCat;

  const optionsByKey: Record<string, SchemeAModelOption[]> = {};

  const pushOpts = (toolKey: string, action: string, opts: SchemeAModelOption[]) => {
    optionsByKey[schemeABillableOptionsKey(toolKey, action)] = opts;
  };

  const fitOpts: SchemeAModelOption[] = [];
  for (const [catalogId, ref] of Object.entries(map.toolsSchemeA.aiTryOn)) {
    const row = findLine(lines, ref.billingKind, ref.modelKey, "");
    const j = row?.costJson as { costYuanPerOutputImage?: number } | null;
    const cost =
      j && typeof j.costYuanPerOutputImage === "number"
        ? j.costYuanPerOutputImage
        : null;
    fitOpts.push({
      catalogModelId: catalogId,
      label: `${catalogId}（试衣）`,
      defaultCostYuan: cost,
    });
  }
  pushOpts("fitting-room__ai-fit", "try_on", fitOpts);
  pushOpts("fitting-room", "try_on", fitOpts);

  const ttiOpts: SchemeAModelOption[] = [];
  for (const [catalogId, ref] of Object.entries(map.toolsSchemeA.textToImage)) {
    const row = findLine(lines, ref.billingKind, ref.modelKey, "");
    const j = row?.costJson as { costYuanPerImage?: number } | null;
    const cost =
      j && typeof j.costYuanPerImage === "number" ? j.costYuanPerImage : null;
    ttiOpts.push({
      catalogModelId: catalogId,
      label: `${catalogId}（文生图·张）`,
      defaultCostYuan: cost,
    });
  }
  pushOpts("text-to-image", "invoke", ttiOpts);

  const vidOpts: SchemeAModelOption[] = [];
  for (const [catalogId, ref] of Object.entries(map.toolsSchemeA.video)) {
    const row = findLine(lines, ref.billingKind, ref.modelKey, "");
    const j = row?.costJson as { spec?: unknown } | null;
    const cost = j?.spec ? videoUnitCostYuanFromSpec(j.spec) : null;
    vidOpts.push({
      catalogModelId: catalogId,
      label: `${catalogId}（视频·示例5s·720P有声）`,
      defaultCostYuan: cost,
    });
  }
  pushOpts("image-to-video", "invoke", vidOpts);

  const labOpts: SchemeAModelOption[] = [];
  for (const m of map.visualLabAnalysis.models) {
    const row = findLine(lines, "TOKEN_IN_OUT", m.modelKey, m.tierRaw);
    const { inM, outM } = visualEquivalentFor(vCat, m.catalogId);
    const meta = vCat.models.find((x) => x.id === m.catalogId);
    const cost = visualUnitCostFromLine(row, inM, outM);
    labOpts.push({
      catalogModelId: m.catalogId,
      label: `${m.catalogId}${meta?.tierNote ? ` · ${meta.tierNote}` : ""}`,
      defaultCostYuan: cost,
    });
  }
  pushOpts("visual-lab__analysis", "invoke", labOpts);

  return { lines, optionsByKey };
}

export function defaultCostForModelKey(
  optionsByKey: Record<string, SchemeAModelOption[]>,
  toolKey: string,
  action: string | null | undefined,
  catalogModelId: string,
): number | null {
  const opts = optionsByKey[schemeABillableOptionsKey(toolKey, action)] ?? [];
  const hit = opts.find((o) => o.catalogModelId === catalogModelId);
  return hit?.defaultCostYuan ?? null;
}
