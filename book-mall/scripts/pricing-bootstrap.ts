/**
 * 首次/全量：tool-web doc/price.md（Token）+ tools-scheme-a / visual-lab JSON（非 Token）→ 主站价目库 current。
 * 用法：cd book-mall && dotenv -e .env.local -- pnpm exec tsx scripts/pricing-bootstrap.ts
 */
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { PricingBillingKind } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { parsePriceMdChinaMainlandTokenTables } from "../lib/pricing/price-md-china-parser";
import {
  createPricingVersionAndSetCurrent,
  tokenRowsToDraftRows,
} from "../lib/pricing/pricing-import-service";
import type { PricingDraftLine } from "../lib/pricing/price-md-china-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bookRoot = path.resolve(__dirname, "..");
const toolWebRoot = path.resolve(bookRoot, "..", "tool-web");

function readJson(p: string): unknown {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function draftsFromToolsCatalog(toolsPath: string): PricingDraftLine[] {
  const cat = readJson(toolsPath) as {
    aiTryOn: { models: Record<string, { costYuanPerOutputImage: number; tierNote: string }> };
    textToImage: { models: Record<string, { costYuanPerImage: number; tierNote: string }> };
    video: { models: Record<string, unknown> };
  };
  const out: PricingDraftLine[] = [];
  for (const [id, row] of Object.entries(cat.aiTryOn.models)) {
    out.push({
      sectionH2: "tools",
      sectionH3: "aiTryOn",
      modelKey: id,
      modelLabelRaw: `${id} · ${row.tierNote}`,
      tierRaw: "",
      billingKind: "OUTPUT_IMAGE" as PricingBillingKind,
      inputYuanPerMillion: null,
      outputYuanPerMillion: null,
      costJson: { costYuanPerOutputImage: row.costYuanPerOutputImage },
      sourceLine: null,
    });
  }
  for (const [id, row] of Object.entries(cat.textToImage.models)) {
    out.push({
      sectionH2: "tools",
      sectionH3: "textToImage",
      modelKey: id,
      modelLabelRaw: `${id} · ${row.tierNote}`,
      tierRaw: "",
      billingKind: "COST_PER_IMAGE" as PricingBillingKind,
      inputYuanPerMillion: null,
      outputYuanPerMillion: null,
      costJson: { costYuanPerImage: row.costYuanPerImage },
      sourceLine: null,
    });
  }
  for (const [id, spec] of Object.entries(cat.video.models)) {
    out.push({
      sectionH2: "tools",
      sectionH3: "video",
      modelKey: id,
      modelLabelRaw: id,
      tierRaw: "",
      billingKind: "VIDEO_MODEL_SPEC" as PricingBillingKind,
      inputYuanPerMillion: null,
      outputYuanPerMillion: null,
      costJson: { spec },
      sourceLine: null,
    });
  }
  return out;
}

async function main() {
  const priceMdPath = path.join(toolWebRoot, "doc", "price.md");
  const toolsPath = path.join(toolWebRoot, "config", "tools-scheme-a-catalog.json");

  const md = fs.readFileSync(priceMdPath, "utf8");
  const extracted = parsePriceMdChinaMainlandTokenTables(md, {
    sourceRelativePath: "tool-web/doc/price.md",
  });
  const tokenDrafts = tokenRowsToDraftRows(extracted.rows);
  const toolDrafts = draftsFromToolsCatalog(toolsPath);

  const combined = [...tokenDrafts, ...toolDrafts];
  const toolsUtf8 = fs.readFileSync(toolsPath, "utf8");
  const sha = createHash("sha256")
    .update(Buffer.from(extracted.meta.sourceSha256, "utf8"))
    .update(Buffer.from("\n", "utf8"))
    .update(Buffer.from(toolsUtf8, "utf8"))
    .digest("hex");

  const existing = await prisma.pricingSourceVersion.findFirst({ where: { isCurrent: true } });
  if (existing) {
    console.error("已存在 current 价目版本。请先仅用 pricing:import-markdown 更新 Token，或手动清空后重跑 bootstrap。");
    process.exit(1);
  }

  const { versionId } = await createPricingVersionAndSetCurrent(prisma, {
    kind: "bootstrap",
    sourceSha256: sha,
    label: "bootstrap price.md + tools-scheme-a-catalog",
    parseWarnings: extracted.meta.warnings,
    lines: combined,
  });

  console.log(`Bootstrap OK versionId=${versionId} lines=${combined.length}`);
  if (extracted.meta.warnings.length) {
    console.warn("price.md warnings:", extracted.meta.warnings);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
