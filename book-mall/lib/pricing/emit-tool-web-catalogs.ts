import * as fs from "fs";
import * as path from "path";
import type { PrismaClient, PricingBillingKind } from "@prisma/client";

type SyncMap = {
  visualLabAnalysis: {
    catalogRelativePath: string;
    models: Array<{ catalogId: string; modelKey: string; tierRaw: string }>;
  };
  toolsSchemeA: {
    catalogRelativePath: string;
    aiTryOn: Record<string, { modelKey: string; billingKind: PricingBillingKind }>;
    textToImage: Record<string, { modelKey: string; billingKind: PricingBillingKind }>;
    video: Record<string, { modelKey: string; billingKind: PricingBillingKind }>;
  };
};

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

/**
 * 从当前价目库生成 tool-web scheme A catalog 文件（强约束同步）。
 */
export async function emitToolWebSchemeACatalogs(
  prisma: PrismaClient,
  toolWebRoot: string,
): Promise<{ visualPath: string; toolsPath: string; warnings: string[] }> {
  const mapPath = path.join(toolWebRoot, "config", "pricing-catalog-sync-map.json");
  const map = JSON.parse(fs.readFileSync(mapPath, "utf8")) as SyncMap;

  const current = await prisma.pricingSourceVersion.findFirst({
    where: { isCurrent: true },
    include: { lines: true },
  });
  if (!current) {
    throw new Error("无 isCurrent 价目版本：请先 pnpm pricing:bootstrap / pricing:import-markdown");
  }
  const lines = current.lines;
  const warnings: string[] = [];

  const vPath = path.join(toolWebRoot, map.visualLabAnalysis.catalogRelativePath);
  const vCat = JSON.parse(fs.readFileSync(vPath, "utf8")) as {
    retailMultiplier: number;
    defaultEquivalentInputMillion: number;
    defaultEquivalentOutputMillion: number;
    schemeNote: string;
    models: Array<{
      id: string;
      inputYuanPerMillion: number;
      outputYuanPerMillion: number;
      tierNote: string;
      equivalentInputMillion?: number;
      equivalentOutputMillion?: number;
    }>;
  };

  for (const m of map.visualLabAnalysis.models) {
    const row = findLine(lines, "TOKEN_IN_OUT", m.modelKey, m.tierRaw);
    if (!row || row.inputYuanPerMillion == null || row.outputYuanPerMillion == null) {
      warnings.push(`visual-lab ${m.catalogId}: 库中无匹配 TOKEN 行 modelKey=${m.modelKey} tier=${m.tierRaw}`);
      continue;
    }
    const entry = vCat.models.find((x) => x.id === m.catalogId);
    if (!entry) {
      warnings.push(`visual-lab catalog 无 id=${m.catalogId}`);
      continue;
    }
    entry.inputYuanPerMillion = row.inputYuanPerMillion;
    entry.outputYuanPerMillion = row.outputYuanPerMillion;
  }
  vCat.schemeNote =
    "成本字段由主站 PricingSourceLine 经 pnpm pricing:emit-catalogs 同步； retailMultiplier 与等价用量仍以本文件为准；人工请勿手改 input/output 元价。";
  fs.writeFileSync(vPath, `${JSON.stringify(vCat, null, 2)}\n`, "utf8");

  const tPath = path.join(toolWebRoot, map.toolsSchemeA.catalogRelativePath);
  const tCat = JSON.parse(fs.readFileSync(tPath, "utf8")) as {
    retailMultiplier: number;
    schemeNote: string;
    aiTryOn: { defaultModel: string; models: Record<string, { costYuanPerOutputImage: number; tierNote: string }> };
    textToImage: { defaultModel: string; models: Record<string, { costYuanPerImage: number; tierNote: string }> };
    video: { comment?: string; models: Record<string, unknown> };
  };

  for (const [catalogId, ref] of Object.entries(map.toolsSchemeA.aiTryOn)) {
    const row = findLine(lines, ref.billingKind, ref.modelKey, "");
    const j = row?.costJson as { costYuanPerOutputImage?: number } | null;
    if (!row || !j || typeof j.costYuanPerOutputImage !== "number") {
      warnings.push(`aiTryOn ${catalogId}: 缺少 OUTPUT_IMAGE 行 ${ref.modelKey}`);
      continue;
    }
    const ent = tCat.aiTryOn.models[catalogId];
    if (ent) ent.costYuanPerOutputImage = j.costYuanPerOutputImage;
  }

  for (const [catalogId, ref] of Object.entries(map.toolsSchemeA.textToImage)) {
    const row = findLine(lines, ref.billingKind, ref.modelKey, "");
    const j = row?.costJson as { costYuanPerImage?: number } | null;
    if (!row || !j || typeof j.costYuanPerImage !== "number") {
      warnings.push(`textToImage ${catalogId}: 缺少 COST_PER_IMAGE 行 ${ref.modelKey}`);
      continue;
    }
    const ent = tCat.textToImage.models[catalogId];
    if (ent) ent.costYuanPerImage = j.costYuanPerImage;
  }

  for (const [catalogId, ref] of Object.entries(map.toolsSchemeA.video)) {
    const row = findLine(lines, ref.billingKind, ref.modelKey, "");
    const j = row?.costJson as { spec?: unknown } | null;
    if (!row || !j?.spec) {
      warnings.push(`video ${catalogId}: 缺少 VIDEO_MODEL_SPEC ${ref.modelKey}`);
      continue;
    }
    tCat.video.models[catalogId] = j.spec as unknown;
  }

  tCat.schemeNote =
    "非 retailMultiplier 的成本数字由主站 PricingSourceLine 经 pnpm pricing:emit-catalogs 同步；请勿手改成本列。";
  fs.writeFileSync(tPath, `${JSON.stringify(tCat, null, 2)}\n`, "utf8");

  return { visualPath: vPath, toolsPath: tPath, warnings };
}
