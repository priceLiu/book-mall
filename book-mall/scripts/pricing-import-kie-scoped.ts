/**
 * 将 Gateway KIE 价目（kie.ai 积分 × ¥0.036）写入 ModelCostProfile 并发布 ModelCreditPrice。
 *
 *   pnpm pricing:import-kie-scoped
 *   pnpm pricing:import-kie-scoped -- --no-publish
 */
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";

import { prisma } from "../lib/prisma";
import { importModelCostProfileVersioned } from "../lib/pricing/import-model-cost-profile-versioned";
import { collectGatewayKieRoutes } from "../lib/pricing/collect-gateway-kie-routes";
import { fetchAllKiePricingRows } from "../lib/pricing/kie-pricing-api";
import {
  KIE_CREDIT_YUAN,
  KIE_PRICING_SOURCE_URL,
} from "../lib/pricing/kie-pricing-constants";
import {
  LIB_NANO_PRO_KIE_TIER_RULES,
  resolveKieRoutePrice,
  resolveLibNanoProTierPrice,
  specToListCostYuan,
  type ResolvedKieRoutePrice,
} from "../lib/pricing/kie-pricing-match";
import { publishModelCreditPrice } from "../lib/pricing/credit-pricing-engine";
import { createPricingVersionAndSetCurrent } from "../lib/pricing/pricing-import-service";
import type { PricingDraftLine } from "../lib/pricing/price-md-china-types";
import { GATEWAY_CANONICAL_REGISTRY } from "../lib/platform-model/canonical-registry";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NO_PUBLISH = process.argv.includes("--no-publish");
const CAPTURED_AT = "2026-08-08";

function profileId(canonical: string, tier: string): string {
  return `kie-${canonical}-${tier || "default"}-CHANNEL`.slice(0, 120);
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

function noteFor(resolved: ResolvedKieRoutePrice, routeModelKey: string): string {
  return `docs/price/kie.md @ ${CAPTURED_AT} · ${resolved.section ?? ""} · route=${routeModelKey} · kieCredits×${KIE_CREDIT_YUAN}`;
}

async function importProfilesFromKie(
  rows: Awaited<ReturnType<typeof fetchAllKiePricingRows>>,
): Promise<{ upserted: number; missing: string[] }> {
  const routes = collectGatewayKieRoutes();
  let upserted = 0;
  const missing: string[] = [];
  const publishedCanonicals = new Set<string>();
  /** canonical → max listCost（同 canonical 多 route 取较高成本，避免低估） */
  const canonicalMaxCost = new Map<
    string,
    { listCostYuan: number; unit: string; tierRaw?: string; input?: number; output?: number; note: string }
  >();

  for (const route of routes) {
    const resolved = resolveKieRoutePrice(route, rows);
    if (!resolved) {
      missing.push(`${route.canonicalModelKey} ← ${route.modelKey}`);
      continue;
    }
    const cost = specToListCostYuan(resolved);
    const note = noteFor(resolved, route.modelKey);
    const prev = canonicalMaxCost.get(route.canonicalModelKey);
    if (!prev || cost.listCostYuan > prev.listCostYuan) {
      canonicalMaxCost.set(route.canonicalModelKey, {
        listCostYuan: cost.listCostYuan,
        unit: cost.unit,
        tierRaw: cost.tierRaw,
        input: cost.inputListCostYuan,
        output: cost.outputListCostYuan,
        note,
      });
    }
  }

  for (const [canonical, cost] of canonicalMaxCost) {
    await upsertCostProfile({
      canonicalModelKey: canonical,
      vendor: "kie",
      unit: cost.unit as "PER_SEC" | "PER_IMAGE" | "PER_KTOKEN",
      tierRaw: cost.tierRaw,
      listCostYuan: cost.listCostYuan,
      inputListCostYuan: cost.input,
      outputListCostYuan: cost.output,
      note: cost.note,
    });
    upserted += 1;
    publishedCanonicals.add(canonical);
  }

  for (const tier of LIB_NANO_PRO_KIE_TIER_RULES) {
    const resolved = resolveLibNanoProTierPrice(tier, rows);
    if (!resolved) {
      missing.push(`${tier.canonicalModelKey} ← lib-nano-pro/${tier.tierRaw}`);
      continue;
    }
    const cost = specToListCostYuan(resolved);
    await upsertCostProfile({
      canonicalModelKey: tier.canonicalModelKey,
      vendor: "kie",
      unit: "PER_IMAGE",
      tierRaw: tier.tierRaw,
      listCostYuan: cost.listCostYuan,
      note: noteFor(resolved, "nano-banana-pro"),
    });
    upserted += 1;
    publishedCanonicals.add(tier.canonicalModelKey);
  }

  if (!NO_PUBLISH) {
    for (const canonical of publishedCanonicals) {
      const def = GATEWAY_CANONICAL_REGISTRY.find((d) => d.canonicalModelKey === canonical);
      const displayName = def?.displayName ?? canonical;
      try {
        await publishModelCreditPrice({
          canonicalModelKey: canonical,
          displayName,
          publishedBy: "pricing-import-kie-scoped",
        });
      } catch (e) {
        console.warn(`publish skip ${canonical}:`, e instanceof Error ? e.message : e);
      }
    }
    // lib-nano-pro 主 offering 同步默认 2K 档积分
    try {
      await publishModelCreditPrice({
        canonicalModelKey: "lib-nano-pro-2k",
        displayName: "Nano Banana Pro (KIE) 2K",
        publishedBy: "pricing-import-kie-scoped",
      });
    } catch (e) {
      console.warn("publish skip lib-nano-pro-2k:", e instanceof Error ? e.message : e);
    }
    console.log("(skip autoPublishPlatformOfferings — run pnpm pricing:publish-kie-credits + sync separately if needed)");
  }

  return { upserted, missing };
}

async function importPricingSourceVersion(rows: Awaited<ReturnType<typeof fetchAllKiePricingRows>>) {
  const kiePath = path.resolve(__dirname, "../../docs/price/kie.md");
  if (!fs.existsSync(kiePath)) {
    console.warn("docs/price/kie.md missing — run fetch-kie-pricing-snapshot first");
    return null;
  }
  const md = fs.readFileSync(kiePath, "utf8");
  const sha = createHash("sha256").update(md).digest("hex");
  const routes = collectGatewayKieRoutes();
  const drafts: PricingDraftLine[] = [];
  let lineNo = 1;
  for (const route of routes) {
    const resolved = resolveKieRoutePrice(route, rows);
    if (!resolved) continue;
    const cost = specToListCostYuan(resolved);
    drafts.push({
      sectionH2: "KIE Gateway",
      sectionH3: route.requestKind,
      modelKey: route.modelKey,
      modelLabelRaw: resolved.modelDescription,
      tierRaw: cost.tierRaw ?? "",
      billingKind:
        resolved.kind === "token"
          ? "TOKEN_IN_OUT"
          : resolved.kind === "video"
            ? "VIDEO_MODEL_SPEC"
            : "COST_PER_IMAGE",
      inputYuanPerMillion:
        resolved.kind === "token" ? cost.inputListCostYuan! * 1000 : null,
      outputYuanPerMillion:
        resolved.kind === "token" ? cost.outputListCostYuan! * 1000 : null,
      costJson:
        resolved.kind !== "token"
          ? { listCostYuan: cost.listCostYuan, unit: cost.unit, vendor: "kie" }
          : null,
      sourceLine: lineNo++,
    });
  }
  const { versionId } = await createPricingVersionAndSetCurrent(prisma, {
    kind: "markdown",
    sourceSha256: sha,
    label: `docs/price/kie.md @ ${CAPTURED_AT}`,
    parseWarnings: [],
    lines: drafts,
  });
  return versionId;
}

async function main() {
  const rows = await fetchAllKiePricingRows();
  const versionId = await importPricingSourceVersion(rows);
  if (versionId) console.log(`PricingSourceVersion ${versionId}`);

  const { upserted, missing } = await importProfilesFromKie(rows);
  console.log(`ModelCostProfile upserted=${upserted} (source ${KIE_PRICING_SOURCE_URL})`);
  if (missing.length) {
    console.warn(`Missing KIE price (${missing.length}):`);
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
