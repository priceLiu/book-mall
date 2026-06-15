import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "@/lib/prisma";
import { runFullAutoCalibration } from "@/lib/model-catalog/auto-calibrate";
import { backfillModelCatalogVendorFields } from "@/lib/model-catalog/backfill-vendor-fields";

const BOOK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MIN_ACTIVE_COST_PROFILES = 13;

export type PostDbBillingSetupResult = {
  realignRan: boolean;
  bootstrapRan: boolean;
  autoCalibrate: Awaited<ReturnType<typeof runFullAutoCalibration>>;
  vendorBackfill: Awaited<ReturnType<typeof backfillModelCatalogVendorFields>>;
  refreshRan: boolean;
  refreshSummary: string | null;
  counts: {
    activeCostProfiles: number;
    modelCatalog: number;
    modelAlias: number;
    catalogWithVendor: number;
    toolUsageBillingLines: number;
  };
};

function runPnpm(script: string): void {
  execSync(`pnpm ${script}`, {
    cwd: BOOK_ROOT,
    stdio: "inherit",
    env: process.env,
  });
}

/**
 * 迁移/重建库后的价目 + 模型目录 + 账单快照一站式修复（幂等，可重复执行）。
 * 供 `db:seed` 与 `pnpm db:post-billing-setup` 共用。
 */
export async function runPostDbBillingSetup(opts?: {
  /** 跳过历史 ToolBillingDetailLine cloudRow 刷新（仅 seed 加速时可关） */
  skipRefreshSnapshots?: boolean;
}): Promise<PostDbBillingSetupResult> {
  console.log("[post-billing] start …");

  const costProfilesBefore = await prisma.modelCostProfile.count({
    where: { active: true },
  });
  let realignRan = false;
  if (costProfilesBefore < MIN_ACTIVE_COST_PROFILES) {
    console.log(
      `[post-billing] ModelCostProfile active=${costProfilesBefore} < ${MIN_ACTIVE_COST_PROFILES} → seed-platform-model-costs`,
    );
    runPnpm("exec dotenv -e .env.local -- tsx scripts/seed-platform-model-costs.ts");
    realignRan = true;
  } else {
    console.log(
      `[post-billing] skip seed-platform-model-costs (active ModelCostProfile=${costProfilesBefore})`,
    );
  }

  const pricingCurrent = await prisma.pricingSourceVersion.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });
  let bootstrapRan = false;
  if (!pricingCurrent) {
    console.log("[post-billing] no current PricingSourceVersion → pricing:bootstrap");
    runPnpm("pricing:bootstrap");
    bootstrapRan = true;
  } else {
    console.log(
      `[post-billing] skip bootstrap (current PricingSourceVersion=${pricingCurrent.id})`,
    );
  }

  console.log("[post-billing] runFullAutoCalibration …");
  const autoCalibrate = await runFullAutoCalibration();
  console.log("[post-billing] auto-calibrate:", autoCalibrate);

  const vendorBackfill = await backfillModelCatalogVendorFields();
  console.log("[post-billing] vendor backfill:", vendorBackfill);

  const lineCount = await prisma.toolBillingDetailLine.count({
    where: { source: "TOOL_USAGE_GENERATED" },
  });
  const refreshRan = false;
  const refreshSummary: string | null = null;
  if (lineCount > 0) {
    console.log(
      `[post-billing] skip legacy TOOL_USAGE_GENERATED refresh (${lineCount} rows; Finance 2.0 uses GatewayRequestLog)`,
    );
  }

  const counts = {
    activeCostProfiles: await prisma.modelCostProfile.count({
      where: { active: true },
    }),
    modelCatalog: await prisma.modelCatalog.count({ where: { active: true } }),
    modelAlias: await prisma.modelAlias.count({ where: { active: true } }),
    catalogWithVendor: await prisma.modelCatalog.count({
      where: { active: true, vendorProductName: { not: null } },
    }),
    toolUsageBillingLines: lineCount,
  };

  console.log("[post-billing] done:", counts);

  return {
    realignRan,
    bootstrapRan,
    autoCalibrate,
    vendorBackfill,
    refreshRan,
    refreshSummary,
    counts,
  };
}
