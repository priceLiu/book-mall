import { formatEcomImageGenUserError } from "@/lib/ecom/ecom-image-processing-error";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { resolveEcomImageGenConcurrency } from "@/lib/ecom/ecom-image-gen-concurrency";
import { isDetailPageSuiteSizeChartDataLabel } from "./size-chart-constants";
import {
  resolveSizeChartTableForSlot,
  uploadRenderedSizeChartPng,
} from "./size-chart-image";
import { getEcomPlatformSpec, type EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import { persistEcomGenerationRecord } from "@/lib/ecom/ecom-generation-record";
import { prisma } from "@/lib/prisma";

import {
  materializeModuleSlots,
  mergeModuleSlotsPreservingContent,
  resolveModuleDisplaySlots,
} from "./module-slots";
import {
  formatDetailPageSuiteImageGenFailureLine,
  mergeDetailPageSuiteImageGenFailures,
  type DetailPageSuiteImageGenFailuresMap,
} from "./image-gen-failures";
import {
  clearDetailPageSuiteImagesPending,
  markDetailPageSuiteImagesPending,
  reconcileDetailPageSuitePendingMeta,
} from "./pending-state";
import {
  upsertDetailPageSuitePromptSnapshots,
  upsertPromptSnapshotsFromSuite,
} from "./prompt-snapshot";
import {
  getDetailPageSuiteHitProject,
  getDetailPageSuiteProject,
  getDetailPageSuiteReplicaProject,
  updateDetailPageSuiteHitProject,
  updateDetailPageSuiteProject,
  updateDetailPageSuiteReplicaProject,
} from "./project-service";
import { normalizeDetailPageSuiteState } from "./suite-persist";
import { composeDetailPageSuiteVisiblePrompt } from "./brief-context";
import {
  appendDetailPageSuiteImageRefLegend,
  detailPageSuiteSlotInvolvesModel,
  resolveDetailPageSuiteImageRefPack,
} from "./image-ref-pack";
import {
  buildHitDetailPageImagePrompt,
  mergeHitDetailPageImageNegativePrompt,
} from "@/lib/ecom/detail-page-suite-hit/hit-image-prompt";
import {
  BLANK_PLATE_MODULE_IDS,
  DETAIL_PAGE_SUITE_NEGATIVE_PROMPT,
  ECOM_DETAIL_PAGE_SUITE_HIT_MODULE,
  ECOM_DETAIL_PAGE_SUITE_HIT_TOOL_KEY,
  ECOM_DETAIL_PAGE_SUITE_MODULE,
  ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE,
  ECOM_DETAIL_PAGE_SUITE_REPLICA_TOOL_KEY,
  ECOM_DETAIL_PAGE_SUITE_TOOL_KEY,
  type DetailPageSuiteModuleState,
} from "./types";

export type DetailPageSuiteImageTarget = {
  moduleId: string;
  moduleName: string;
  slotKey: string;
  itemLabel: string;
  prompt: string;
  negativePrompt?: string;
  slotCopy?: string;
};

/** 与前端 `resolveModuleDisplaySlots` + composite slotKeys 对齐，供出图与单测复用 */
export function collectDetailPageSuiteImageTargets(
  modules: DetailPageSuiteModuleState[],
  opts: {
    moduleId?: string;
    slotKey?: string;
    slotKeys?: string[];
    onlySelected?: boolean;
  },
): DetailPageSuiteImageTarget[] {
  const explicitKeys = new Set(
    (opts.slotKeys ?? []).map((k) => k.trim()).filter(Boolean),
  );
  const targets: DetailPageSuiteImageTarget[] = [];
  const seenComposites = new Set<string>();
  for (const m of modules) {
    if (opts.moduleId && m.module_id !== opts.moduleId) continue;
    if (!m.enable) continue;
    for (const slot of resolveModuleDisplaySlots(m)) {
      if (opts.slotKey && slot.item_key !== opts.slotKey) continue;
      const composite = `${m.module_id}::${slot.item_key}`;
      if (explicitKeys.size > 0 && !explicitKeys.has(composite)) continue;
      if (opts.onlySelected && slot.selectedForImage === false) continue;
      if (!slot.positive_prompt.trim()) continue;
      if (seenComposites.has(composite)) continue;
      seenComposites.add(composite);
      targets.push({
        moduleId: m.module_id,
        moduleName: m.module_name,
        slotKey: slot.item_key,
        itemLabel: slot.item_label,
        prompt: slot.positive_prompt,
        negativePrompt: slot.negative_prompt?.trim() || undefined,
        slotCopy: slot.slot_copy?.trim() || undefined,
      });
    }
  }
  return targets;
}

export function normalizeDetailPageSuiteImageGenSlotKeys(
  slotKeys: string[] | undefined,
): string[] | undefined {
  if (!slotKeys?.length) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of slotKeys) {
    const k = raw.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out.length > 0 ? out : undefined;
}

async function persistDetailPageSuiteSlotGenerationRecord(opts: {
  userId: string;
  projectId: string;
  ossUrl: string;
  title: string;
  prompt: string;
  assetModule: string;
  genToolKey: string;
  moduleId: string;
  slotKey: string;
  modelKey: string;
}): Promise<void> {
  try {
    await persistEcomGenerationRecord({
      userId: opts.userId,
      ossUrl: opts.ossUrl,
      title: opts.title,
      prompt: opts.prompt,
      meta: {
        sourceModule: opts.assetModule,
        sourceToolKey: opts.genToolKey,
        projectId: opts.projectId,
        sourceResultId: `${opts.moduleId}::${opts.slotKey}`,
        versionKey: `${opts.projectId}::${opts.moduleId}::${opts.slotKey}`,
        modelKey: opts.modelKey,
      },
    });
  } catch (e) {
    console.warn("[detail-page-suite] generation record failed", {
      projectId: opts.projectId,
      slot: `${opts.moduleId}::${opts.slotKey}`,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

function mergeSuiteNegativePrompt(slotNegative?: string): string {
  const extra = slotNegative?.trim();
  if (!extra) return DETAIL_PAGE_SUITE_NEGATIVE_PROMPT;
  return `${DETAIL_PAGE_SUITE_NEGATIVE_PROMPT}，${extra}`;
}

export async function generateDetailPageSuiteImages(opts: {
  userId: string;
  projectId: string;
  moduleId?: string;
  slotKey?: string;
  /** `${moduleId}::${slotKey}` 列表；与 onlySelected 二选一或组合 */
  slotKeys?: string[];
  onlySelected?: boolean;
  modelKey?: string;
  imageSize?: string;
  imageRatio?: "1:1" | "3:4" | "4:5" | "16:9";
  /** 默认 detail-page-suite；复刻 / 爆款传对应 module */
  projectModule?: string;
  /** 爆款套图：出图时将 slot_copy 写入 prompt，并放宽「画面文字」负向 */
  includeSlotCopyOnImage?: boolean;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const moduleKey = opts.projectModule?.trim() || ECOM_DETAIL_PAGE_SUITE_MODULE;
  const isReplica = moduleKey === ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE;
  const isHit = moduleKey === ECOM_DETAIL_PAGE_SUITE_HIT_MODULE;
  let project = isHit
    ? await getDetailPageSuiteHitProject(opts.userId, opts.projectId)
    : isReplica
      ? await getDetailPageSuiteReplicaProject(opts.userId, opts.projectId)
      : await getDetailPageSuiteProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  const updateProject = isHit
    ? updateDetailPageSuiteHitProject
    : isReplica
      ? updateDetailPageSuiteReplicaProject
      : updateDetailPageSuiteProject;
  const assetModule = isHit
    ? ECOM_DETAIL_PAGE_SUITE_HIT_MODULE
    : isReplica
      ? ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE
      : ECOM_DETAIL_PAGE_SUITE_MODULE;
  const genToolKey = isHit
    ? ECOM_DETAIL_PAGE_SUITE_HIT_TOOL_KEY
    : isReplica
      ? ECOM_DETAIL_PAGE_SUITE_REPLICA_TOOL_KEY
      : ECOM_DETAIL_PAGE_SUITE_TOOL_KEY;

  const includeSlotCopyOnImage =
    isHit &&
    (opts.includeSlotCopyOnImage === true ||
      project.settings.hitIncludeSlotCopyOnImage === true);

  const modelKey =
    opts.modelKey?.trim() ||
    project.settings.imageModelKey ||
    ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;
  const spec = getEcomPlatformSpec(project.brief?.platformCode);
  const ratio = (opts.imageRatio ||
    project.settings.imageRatio ||
    spec.detailPage.ratio ||
    "3:4") as EcomImageRatio;
  const refPack = resolveDetailPageSuiteImageRefPack(project.references, modelKey);
  const refs = refPack.urls;
  const imageConcurrency = await resolveEcomImageGenConcurrency(opts.userId, project.settings);
  const normalizedSlotKeys = normalizeDetailPageSuiteImageGenSlotKeys(opts.slotKeys);
  if (isHit && !normalizedSlotKeys?.length) {
    throw new Error("请勾选要出图的点位（缺少 slotKeys）");
  }
  const collectOpts = {
    ...opts,
    slotKeys: normalizedSlotKeys ?? opts.slotKeys,
    onlySelected: normalizedSlotKeys?.length ? false : opts.onlySelected,
  };
  const targets = collectDetailPageSuiteImageTargets(project.suite.modules, collectOpts);
  if (targets.length === 0) {
    throw new Error("没有可生成的提示词，请先生成提示词或保存编辑后再出图");
  }
  console.info("[detail-page-suite] image gen batch", {
    projectId: opts.projectId,
    projectModule: moduleKey,
    modelKey,
    refProductCount: refPack.productCount,
    refModelCount: refPack.modelCount,
    refStyleFirst: refPack.styleFirst,
    slotKeyCount: normalizedSlotKeys?.length ?? 0,
    targetCount: targets.length,
    targets: targets.map((t) => `${t.moduleId}::${t.slotKey}`),
  });
  if (normalizedSlotKeys?.length && targets.length !== normalizedSlotKeys.length) {
    console.warn("[detail-page-suite] image gen slotKeys/targets mismatch", {
      projectId: opts.projectId,
      module: moduleKey,
      requested: normalizedSlotKeys,
      resolved: targets.map((t) => `${t.moduleId}::${t.slotKey}`),
    });
  }

  const pendingKeys = targets.map((t) => `${t.moduleId}::${t.slotKey}`);
  let metaWithPending = upsertDetailPageSuitePromptSnapshots(
    project.meta,
    targets.map((t) => ({
      moduleId: t.moduleId,
      slotKey: t.slotKey,
      itemLabel: t.itemLabel,
      prompt: t.prompt,
    })),
  );
  const targetModuleIds = new Set(targets.map((t) => t.moduleId));
  const preflightModules = project.suite.modules.map((m) =>
    targetModuleIds.has(m.module_id)
      ? { ...m, slots: materializeModuleSlots(m, metaWithPending.promptSnapshots) }
      : m,
  );
  const preflightSuite = normalizeDetailPageSuiteState(
    { ...project.suite, modules: preflightModules },
    metaWithPending,
  );
  metaWithPending = markDetailPageSuiteImagesPending(metaWithPending, pendingKeys, modelKey);
  const preflightSaved = await updateProject(opts.userId, opts.projectId, {
    suite: preflightSuite,
    meta: metaWithPending,
  });
  if (preflightSaved) {
    project = preflightSaved;
  } else {
    project = { ...project, suite: preflightSuite, meta: metaWithPending };
  }

  const failures: string[] = [];
  const failureEntries: DetailPageSuiteImageGenFailuresMap = {};
  const successKeys: string[] = [];
  const urlMap = new Map<string, string>();
  const assetMap = new Map<string, string>();
  const failedAt = new Date().toISOString();
  try {
  let sizeChartTableIndex = 0;
  await mapWithConcurrency(targets, async (t) => {
    const key = `${t.moduleId}::${t.slotKey}`;
    try {
      const slotTitle = `${t.moduleName} · ${t.itemLabel}`.slice(0, 80);
      let promptForRecord = t.prompt;
      const url = isDetailPageSuiteSizeChartDataLabel(t.itemLabel)
        ? await uploadRenderedSizeChartPng({
            userId: opts.userId,
            table: resolveSizeChartTableForSlot(
              project.brief,
              sizeChartTableIndex++,
            ),
          })
        : await (async () => {
            const involvesModel = detailPageSuiteSlotInvolvesModel({
              moduleId: t.moduleId,
              moduleName: t.moduleName,
              itemLabel: t.itemLabel,
            });
            let prompt = composeDetailPageSuiteVisiblePrompt(
              t.prompt,
              project.brief,
              t.itemLabel,
              t.moduleId,
            );
            if (includeSlotCopyOnImage) {
              prompt = buildHitDetailPageImagePrompt({
                positivePrompt: prompt,
                slotCopy: t.slotCopy,
                includeSlotCopyOnImage: true,
              });
            }
            if (refPack.urls.length > 0) {
              prompt = appendDetailPageSuiteImageRefLegend(
                prompt,
                refPack,
                involvesModel,
              );
            }
            promptForRecord = prompt;
            return generateEcomImage({
              userId: opts.userId,
              modelKey,
              prompt,
              negativePrompt: includeSlotCopyOnImage
                ? mergeHitDetailPageImageNegativePrompt(t.negativePrompt, true)
                : mergeSuiteNegativePrompt(t.negativePrompt),
              ratio,
              imageSize: opts.imageSize || project.settings.imageSize,
              refImageUrls: BLANK_PLATE_MODULE_IDS.has(t.moduleId) ? [] : refs,
              toolKey: `${genToolKey}__generate`,
            });
          })();
      urlMap.set(key, url);
      successKeys.push(key);
      const asset = await prisma.ecomAsset.create({
        data: {
          userId: opts.userId,
          module: assetModule,
          kind: "image",
          title: slotTitle,
          prompt: promptForRecord,
          ossUrl: url,
          thumbnailUrl: url,
          meta: {
            projectId: opts.projectId,
            source: assetModule,
            moduleId: t.moduleId,
            slotKey: t.slotKey,
            platform: spec.code,
            modelKey,
          },
        },
      });
      assetMap.set(key, asset.id);
      await persistDetailPageSuiteSlotGenerationRecord({
        userId: opts.userId,
        projectId: opts.projectId,
        ossUrl: url,
        title: slotTitle,
        prompt: promptForRecord,
        assetModule,
        genToolKey,
        moduleId: t.moduleId,
        slotKey: t.slotKey,
        modelKey,
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const message = formatEcomImageGenUserError(e).message;
      failures.push(
        formatDetailPageSuiteImageGenFailureLine(key, message, { itemLabel: t.itemLabel }),
      );
      failureEntries[key] = { message, failedAt, modelKey };
      console.error("[detail-page-suite] image gen failed", {
        projectId: opts.projectId,
        userId: opts.userId,
        modelKey,
        slotKey: key,
        itemLabel: t.itemLabel,
        message: raw,
      });
    }
  }, imageConcurrency);

  if (failures.length > 0) {
    console.error("[detail-page-suite] image gen batch summary", {
      projectId: opts.projectId,
      userId: opts.userId,
      modelKey,
      generated: urlMap.size,
      failed: failures.length,
      failures,
    });
  }

  const now = new Date().toISOString();
  const modules = project.suite.modules.map((m) => {
    const base = materializeModuleSlots(m, metaWithPending.promptSnapshots);
    return {
      ...m,
      slots: mergeModuleSlotsPreservingContent(
        base,
        base.map((s) => {
        const key = `${m.module_id}::${s.item_key}`;
        const url = urlMap.get(key);
        const assetId = assetMap.get(key);
        if (!url) return s;
        const prevHistory =
          Array.isArray(s.imageHistory) && s.imageHistory.length > 0
            ? s.imageHistory.filter((v) => v.url?.trim())
            : s.imageUrl?.trim()
              ? [
                  {
                    url: s.imageUrl,
                    assetId: s.assetId,
                    createdAt: new Date(0).toISOString(),
                  },
                ]
              : [];
        const imageHistory = [
          ...prevHistory,
          { url, assetId: assetId ?? s.assetId, createdAt: now },
        ];
        const activeImageIndex = imageHistory.length - 1;
        return {
          ...s,
          imageUrl: url,
          assetId: assetId ?? s.assetId,
          imageHistory,
          activeImageIndex,
        };
      }),
      ),
    };
  });
  metaWithPending =
    clearDetailPageSuiteImagesPending(metaWithPending, pendingKeys) ?? { phase: "images" };
  const resultSuite = { ...project.suite, modules };
  const metaWithFailures = mergeDetailPageSuiteImageGenFailures(
    { ...metaWithPending, phase: "images" },
    failureEntries,
    successKeys,
  );
  const reconciledMeta = upsertPromptSnapshotsFromSuite(
    reconcileDetailPageSuitePendingMeta(resultSuite, metaWithFailures),
    resultSuite,
  );
  const updated = await updateProject(opts.userId, opts.projectId, {
    suite: resultSuite,
    settings: {
      ...project.settings,
      imageModelKey: modelKey,
      imageRatio: ratio,
      ...(opts.imageSize || project.settings.imageSize
        ? { imageSize: opts.imageSize || project.settings.imageSize }
        : {}),
    },
    meta: reconciledMeta,
    status: "ready",
  });
  if (!updated) throw new Error("保存失败");
  return { project: updated, generated: urlMap.size, failures };
  } catch (e) {
    metaWithPending = clearDetailPageSuiteImagesPending(metaWithPending, pendingKeys) ?? metaWithPending;
    const failureSuite = normalizeDetailPageSuiteState(project.suite, metaWithPending);
    await updateProject(opts.userId, opts.projectId, {
      suite: failureSuite,
      meta: reconcileDetailPageSuitePendingMeta(failureSuite, metaWithPending),
    });
    throw e;
  }
}
