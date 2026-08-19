/**
 * 模型运营中心 · 初始化 sourceLabel 与 AppModelShelf 回填。
 *
 *   pnpm gateway:seed-model-ops              # 预览
 *   pnpm gateway:seed-model-ops -- --confirm # 落库
 *   pnpm gateway:seed-model-ops -- --confirm --force-labels  # 强制刷新全部 sourceLabel
 */
import marketPresentation from "../config/gateway-market-presentation.json";
import { presentationSourceLabelFor, resolveSourceLabel } from "../lib/gateway/model-source-label";
import { resolveKnownGatewayModelRegistration } from "../lib/gateway/model-registry";
import {
  GLOBAL_APP_TAGS,
  SCENE_SHELF_SPECS,
} from "../lib/platform-model/model-ops-seed-config";
import { upsertShelfRows, updateCatalogSourceLabels } from "../lib/platform-model/app-model-shelf";
import { ensureGatewayCanonicalRegistrySynced } from "../lib/gateway/sync-canonical-registry";
import { prisma } from "../lib/prisma";

const PRESENTATION = marketPresentation as {
  models?: Record<string, { providerLabel?: string }>;
};

async function resolveCanonicalForModelKey(modelKey: string): Promise<string | null> {
  const fromCode = resolveKnownGatewayModelRegistration(modelKey);
  if (fromCode) return fromCode.canonicalModelKey;
  const route = await prisma.gatewayModelRoute.findFirst({
    where: { active: true, modelKey: modelKey.trim() },
    select: { canonicalModelKey: true },
  });
  return route?.canonicalModelKey ?? null;
}

async function seedAllSourceLabels(force: boolean): Promise<number> {
  await ensureGatewayCanonicalRegistrySynced();
  const catalogs = await prisma.modelCatalog.findMany({
    where: { gatewayPublished: true },
    select: { canonicalKey: true, sourceLabel: true },
  });

  const routes = await prisma.gatewayModelRoute.findMany({
    where: { active: true },
    select: { canonicalModelKey: true, providerKind: true, vendor: true },
  });
  const routeByCanonical = new Map<string, { providerKind: string; vendor: string }>();
  for (const r of routes) {
    if (!routeByCanonical.has(r.canonicalModelKey)) {
      routeByCanonical.set(r.canonicalModelKey, {
        providerKind: r.providerKind,
        vendor: r.vendor,
      });
    }
  }

  const updates: Array<{ canonicalModelKey: string; sourceLabel: string | null }> = [];
  for (const cat of catalogs) {
    if (!force && cat.sourceLabel?.trim()) continue;
    const route = routeByCanonical.get(cat.canonicalKey);
    const fromJson = PRESENTATION.models?.[cat.canonicalKey]?.providerLabel?.trim();
    if (fromJson) {
      updates.push({ canonicalModelKey: cat.canonicalKey, sourceLabel: fromJson });
      continue;
    }
    if (route) {
      const label = resolveSourceLabel({
        canonicalModelKey: cat.canonicalKey,
        providerKind: route.providerKind as never,
        vendor: route.vendor,
      });
      updates.push({ canonicalModelKey: cat.canonicalKey, sourceLabel: label });
    }
  }

  if (updates.length === 0) return 0;
  return updateCatalogSourceLabels(updates);
}

async function seedGlobalAppShelves(): Promise<number> {
  const catalogs = await prisma.modelCatalog.findMany({
    where: { gatewayPublished: true, active: true },
    select: { canonicalKey: true, appTags: true },
    orderBy: { displayName: "asc" },
  });

  const rows: Array<{
    appTag: string;
    sceneKey: string;
    canonicalModelKey: string;
    status: "ACTIVE";
    sortOrder: number;
  }> = [];

  for (const appTag of GLOBAL_APP_TAGS) {
    const matched = catalogs.filter((c) =>
      c.appTags.some((t) => t.toLowerCase() === appTag),
    );
    matched.forEach((c, idx) => {
      rows.push({
        appTag,
        sceneKey: "",
        canonicalModelKey: c.canonicalKey,
        status: "ACTIVE",
        sortOrder: idx,
      });
    });
  }

  if (rows.length === 0) return 0;
  return upsertShelfRows(rows);
}

async function seedSceneShelves(dryRun: boolean): Promise<{
  upserted: number;
  skippedKeys: string[];
}> {
  const skippedKeys: string[] = [];
  const rows: Array<{
    appTag: string;
    sceneKey: string;
    canonicalModelKey: string;
    status: "ACTIVE";
    sortOrder: number;
  }> = [];

  for (const spec of SCENE_SHELF_SPECS) {
    const seenCanonical = new Set<string>();
    let sortOrder = 0;
    for (const modelKey of spec.modelKeys) {
      const canonical = await resolveCanonicalForModelKey(modelKey);
      if (!canonical) {
        skippedKeys.push(`${spec.appTag}/${spec.sceneKey}:${modelKey}`);
        continue;
      }
      if (seenCanonical.has(canonical)) continue;
      seenCanonical.add(canonical);
      rows.push({
        appTag: spec.appTag,
        sceneKey: spec.sceneKey,
        canonicalModelKey: canonical,
        status: "ACTIVE",
        sortOrder: sortOrder++,
      });
    }
  }

  if (dryRun) {
    console.log(`[dry-run] 场景上架 ${rows.length} 条，跳过 ${skippedKeys.length} 个 modelKey`);
    return { upserted: rows.length, skippedKeys };
  }

  if (rows.length === 0) return { upserted: 0, skippedKeys };
  const count = await upsertShelfRows(rows);
  return { upserted: count, skippedKeys };
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const forceLabels = process.argv.includes("--force-labels");
  const dryRun = !confirm;

  if (dryRun) {
    console.log("预览模式（加 --confirm 落库）");
    console.log(`全局 appTags: ${GLOBAL_APP_TAGS.join(", ")}`);
    console.log(`场景配置: ${SCENE_SHELF_SPECS.length} 个 scene`);
    const scenePreview = await seedSceneShelves(true);
    if (scenePreview.skippedKeys.length) {
      console.log("未解析 canonical 的 modelKey（前 20 条）:");
      for (const k of scenePreview.skippedKeys.slice(0, 20)) {
        console.log(`  - ${k}`);
      }
      if (scenePreview.skippedKeys.length > 20) {
        console.log(`  ... 另有 ${scenePreview.skippedKeys.length - 20} 条`);
      }
    }
    return;
  }

  const labelCount = await seedAllSourceLabels(forceLabels);
  console.log(
    `已更新 ${labelCount} 个 sourceLabel${forceLabels ? "（强制刷新）" : ""}。`,
  );

  const globalCount = await seedGlobalAppShelves();
  console.log(`已回填 ${globalCount} 条 AppModelShelf（appTag 全局 sceneKey=""）。`);

  const sceneResult = await seedSceneShelves(false);
  console.log(
    `已回填 ${sceneResult.upserted} 条 AppModelShelf（Canvas / QuickReplica 场景级）。`,
  );
  if (sceneResult.skippedKeys.length) {
    console.warn(`警告: ${sceneResult.skippedKeys.length} 个 modelKey 未找到 canonical，已跳过`);
  }

  const sample = presentationSourceLabelFor("grok-imagine/text-to-image");
  console.log(`抽样: grok-imagine/text-to-image presentation → ${sample ?? "—"}`);

  const kieSample = await prisma.modelCatalog.findFirst({
    where: {
      canonicalKey: { contains: "kie" },
      routes: { some: { providerKind: "KIE", active: true } },
    },
    select: { canonicalKey: true, sourceLabel: true },
  });
  if (kieSample) {
    console.log(`抽样 KIE: ${kieSample.canonicalKey} → sourceLabel=${kieSample.sourceLabel}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
