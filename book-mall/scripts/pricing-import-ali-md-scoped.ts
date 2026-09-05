/**
 * 将 Gateway 百炼价目写入 ModelCostProfile 并发布 ModelCreditPrice。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/pricing-import-ali-md-scoped.ts
 *   pnpm exec dotenv -e .env.local -- tsx scripts/pricing-import-ali-md-scoped.ts --no-publish
 */
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";

import { prisma } from "../lib/prisma";
import { importModelCostProfileVersioned } from "../lib/pricing/import-model-cost-profile-versioned";
import { collectGatewayAliyunRoutes } from "../lib/pricing/collect-gateway-aliyun-routes";
import {
  GATEWAY_ALI_PRICE_BY_MODEL_KEY,
  ktokenFromMillion,
  unitForAliSpec,
  type GatewayAliPriceSpec,
} from "../lib/pricing/gateway-bailian-price-catalog";
import { publishModelCreditPrice } from "../lib/pricing/credit-pricing-engine";
import {
  createPricingVersionAndSetCurrent,
  tokenRowsToDraftRows,
} from "../lib/pricing/pricing-import-service";
import type { PricingDraftLine } from "../lib/pricing/price-md-china-types";
import { parsePriceMdChinaMainlandTokenTables } from "../lib/pricing/price-md-china-parser";
import { autoPublishPlatformOfferings } from "../lib/platform-model/auto-publish-offerings";
import { GATEWAY_CANONICAL_REGISTRY } from "../lib/platform-model/canonical-registry";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NO_PUBLISH = process.argv.includes("--no-publish");

function resolvePriceSpec(modelKey: string): GatewayAliPriceSpec | null {
  const k = modelKey.trim();
  return GATEWAY_ALI_PRICE_BY_MODEL_KEY[k] ?? GATEWAY_ALI_PRICE_BY_MODEL_KEY[k.toLowerCase()] ?? null;
}

function profileId(canonical: string, tier: string): string {
  return `ali-${canonical}-${tier || "default"}-CHANNEL`.slice(0, 120);
}

async function upsertCostProfile(args: {
  canonicalModelKey: string;
  vendor: string;
  unit: "PER_SEC" | "PER_IMAGE" | "PER_KTOKEN";
  tierRaw?: string;
  listCostYuan: number;
  inputListCostYuan?: number;
  outputListCostYuan?: number;
  note: string;
}) {
  const id = profileId(args.canonicalModelKey, args.tierRaw ?? "");
  await importModelCostProfileVersioned({
    canonicalModelKey: args.canonicalModelKey,
    vendor: args.vendor,
    unit: args.unit,
    tierRaw: args.tierRaw ?? null,
    listCostYuan: args.listCostYuan,
    inputListCostYuan: args.inputListCostYuan ?? null,
    outputListCostYuan: args.outputListCostYuan ?? null,
    discountRate: 0,
    note: args.note,
    seedId: id,
  });
}

async function importProfilesFromCatalog(): Promise<{ upserted: number; missing: string[] }> {
  const routes = collectGatewayAliyunRoutes();
  let upserted = 0;
  const missing: string[] = [];
  const publishedCanonicals = new Set<string>();

  for (const route of routes) {
    const spec = resolvePriceSpec(route.modelKey);
    if (!spec) {
      missing.push(`${route.canonicalModelKey} ← ${route.modelKey}`);
      continue;
    }
    const note = `docs/price/ali.md @ 2026-08-08 · ${spec.section ?? ""} · route=${route.modelKey}`;
    if (spec.kind === "token") {
      const inK = ktokenFromMillion(spec.inputYuanPerMillion);
      const outK = ktokenFromMillion(spec.outputYuanPerMillion);
      await upsertCostProfile({
        canonicalModelKey: route.canonicalModelKey,
        vendor: "aliyun",
        unit: "PER_KTOKEN",
        listCostYuan: inK,
        inputListCostYuan: inK,
        outputListCostYuan: outK,
        note,
      });
      upserted += 1;
      publishedCanonicals.add(route.canonicalModelKey);
    } else if (spec.kind === "image") {
      await upsertCostProfile({
        canonicalModelKey: route.canonicalModelKey,
        vendor: "aliyun",
        unit: "PER_IMAGE",
        listCostYuan: spec.yuanPerImage,
        note,
      });
      upserted += 1;
      publishedCanonicals.add(route.canonicalModelKey);
    } else if (spec.kind === "audio") {
      await upsertCostProfile({
        canonicalModelKey: route.canonicalModelKey,
        vendor: "aliyun",
        unit: "PER_SEC",
        listCostYuan: spec.yuanPerSecond,
        note,
      });
      upserted += 1;
      publishedCanonicals.add(route.canonicalModelKey);
    } else if (spec.kind === "video") {
      for (const [tier, yps] of Object.entries(spec.yuanPerSecondByTier)) {
        await upsertCostProfile({
          canonicalModelKey: route.canonicalModelKey,
          vendor: "aliyun",
          unit: "PER_SEC",
          tierRaw: tier,
          listCostYuan: yps,
          note: `${note} · ${tier}`,
        });
        upserted += 1;
      }
      publishedCanonicals.add(route.canonicalModelKey);
    }
  }

  if (!publishedCanonicals.has("qwen3-asr-flash-filetrans")) {
    const asr = GATEWAY_ALI_PRICE_BY_MODEL_KEY["qwen3-asr-flash-filetrans"];
    if (asr?.kind === "audio") {
      await upsertCostProfile({
        canonicalModelKey: "qwen3-asr-flash-filetrans",
        vendor: "aliyun",
        unit: "PER_SEC",
        listCostYuan: asr.yuanPerSecond,
        note: "docs/price/ali.md @ 2026-08-08 · ASR",
      });
      upserted += 1;
      publishedCanonicals.add("qwen3-asr-flash-filetrans");
    }
  }

  if (!NO_PUBLISH) {
    for (const canonical of publishedCanonicals) {
      const def = GATEWAY_CANONICAL_REGISTRY.find((d) => d.canonicalModelKey === canonical);
      const displayName = def?.displayName ?? canonical;
      try {
        await publishModelCreditPrice({
          canonicalModelKey: canonical,
          displayName,
          publishedBy: "pricing-import-ali-md-scoped",
        });
      } catch (e) {
        console.warn(`publish skip ${canonical}:`, e instanceof Error ? e.message : e);
      }
    }
    await autoPublishPlatformOfferings();
  }

  return { upserted, missing };
}

async function importPricingSourceLines() {
  const aliPath = path.resolve(__dirname, "../../docs/price/ali.md");
  const md = fs.readFileSync(aliPath, "utf8");
  const sha = createHash("sha256").update(md).digest("hex");
  const extracted = parsePriceMdChinaMainlandTokenTables(md, {
    sourceRelativePath: "docs/price/ali.md",
  });
  const tokenDrafts: PricingDraftLine[] = tokenRowsToDraftRows(extracted.rows);
  const { versionId } = await createPricingVersionAndSetCurrent(prisma, {
    kind: "markdown",
    sourceSha256: sha,
    label: "docs/price/ali.md @ 2026-08-08",
    parseWarnings: extracted.meta.warnings,
    lines: tokenDrafts,
  });
  return { versionId, tokenRows: tokenDrafts.length };
}

async function main() {
  const { versionId, tokenRows } = await importPricingSourceLines();
  console.log(`PricingSourceVersion ${versionId} token rows=${tokenRows}`);

  const { upserted, missing } = await importProfilesFromCatalog();
  console.log(`ModelCostProfile upserted=${upserted}`);
  if (missing.length) {
    console.warn(`Missing price spec (${missing.length}):`);
    for (const m of missing) console.warn(`  - ${m}`);
  }
  if (NO_PUBLISH) console.log("(skipped publish, --no-publish)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
