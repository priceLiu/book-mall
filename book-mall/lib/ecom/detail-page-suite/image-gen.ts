import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { getEcomPlatformSpec, type EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import { prisma } from "@/lib/prisma";

import { getDetailPageSuiteProject, updateDetailPageSuiteProject } from "./project-service";
import {
  DETAIL_PAGE_SUITE_NEGATIVE_PROMPT,
  ECOM_DETAIL_PAGE_SUITE_MODULE,
  ECOM_DETAIL_PAGE_SUITE_TOOL_KEY,
} from "./types";

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
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const project = await getDetailPageSuiteProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const modelKey =
    opts.modelKey?.trim() ||
    project.settings.imageModelKey ||
    ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;
  const spec = getEcomPlatformSpec(project.brief?.platformCode);
  const ratio = (opts.imageRatio ||
    project.settings.imageRatio ||
    spec.detailPage.ratio ||
    "3:4") as EcomImageRatio;
  const refs = project.references.map((r) => r.ossUrl).filter(Boolean);
  const explicitKeys = new Set(
    (opts.slotKeys ?? []).map((k) => k.trim()).filter(Boolean),
  );

  type Target = { moduleId: string; moduleName: string; slotKey: string; itemLabel: string; prompt: string };
  const targets: Target[] = [];
  for (const m of project.suite.modules) {
    if (opts.moduleId && m.module_id !== opts.moduleId) continue;
    if (!m.enable) continue;
    for (const slot of m.slots) {
      if (opts.slotKey && slot.item_key !== opts.slotKey) continue;
      const composite = `${m.module_id}::${slot.item_key}`;
      if (explicitKeys.size > 0 && !explicitKeys.has(composite)) continue;
      if (opts.onlySelected && slot.selectedForImage === false) continue;
      if (!slot.positive_prompt.trim()) continue;
      targets.push({
        moduleId: m.module_id,
        moduleName: m.module_name,
        slotKey: slot.item_key,
        itemLabel: slot.item_label,
        prompt: slot.positive_prompt,
      });
    }
  }
  if (targets.length === 0) throw new Error("没有可生成的提示词，请先生成提示词");

  const failures: string[] = [];
  const urlMap = new Map<string, string>();
  const assetMap = new Map<string, string>();
  await mapWithConcurrency(targets, async (t) => {
    try {
      const url = await generateEcomImage({
        userId: opts.userId,
        modelKey,
        prompt: t.prompt,
        negativePrompt: DETAIL_PAGE_SUITE_NEGATIVE_PROMPT,
        ratio,
        imageSize: opts.imageSize || project.settings.imageSize,
        refImageUrls: refs,
        toolKey: `${ECOM_DETAIL_PAGE_SUITE_TOOL_KEY}__generate`,
      });
      const key = `${t.moduleId}::${t.slotKey}`;
      urlMap.set(key, url);
      const asset = await prisma.ecomAsset.create({
        data: {
          userId: opts.userId,
          module: ECOM_DETAIL_PAGE_SUITE_MODULE,
          kind: "image",
          title: `${t.moduleName} · ${t.itemLabel}`.slice(0, 80),
          prompt: t.prompt,
          ossUrl: url,
          thumbnailUrl: url,
          meta: {
            projectId: opts.projectId,
            source: "detail-page-suite",
            moduleId: t.moduleId,
            slotKey: t.slotKey,
            platform: spec.code,
            modelKey,
          },
        },
      });
      assetMap.set(key, asset.id);
    } catch (e) {
      failures.push(
        `${t.moduleId}/${t.slotKey}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, 2);

  const now = new Date().toISOString();
  const modules = project.suite.modules.map((m) => ({
    ...m,
    slots: m.slots.map((s) => {
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
  }));
  const updated = await updateDetailPageSuiteProject(opts.userId, opts.projectId, {
    suite: { ...project.suite, modules },
    settings: {
      ...project.settings,
      imageModelKey: modelKey,
      imageRatio: ratio,
      ...(opts.imageSize || project.settings.imageSize
        ? { imageSize: opts.imageSize || project.settings.imageSize }
        : {}),
    },
    meta: { ...(project.meta ?? {}), phase: "images" },
    status: "ready",
  });
  if (!updated) throw new Error("保存失败");
  return { project: updated, generated: urlMap.size, failures };
}
