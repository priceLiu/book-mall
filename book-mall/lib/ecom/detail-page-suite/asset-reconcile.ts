import { prisma } from "@/lib/prisma";

import {
  mergeModuleSlotsPreservingContent,
  resolveModuleDisplaySlots,
} from "./module-slots";
import { reconcileDetailPageSuitePendingMeta } from "./pending-state";
import { updateDetailPageSuiteProject } from "./project-service";
import {
  ECOM_DETAIL_PAGE_SUITE_MODULE,
  type DetailPageSuiteModuleState,
  type DetailPageSuiteProject,
  type DetailPageSuiteSlot,
  type DetailPageSuiteSlotImageVersion,
} from "./types";

type SuiteAssetMeta = {
  projectId?: string;
  moduleId?: string;
  slotKey?: string;
  source?: string;
};

function readSuiteAssetMeta(meta: unknown): SuiteAssetMeta {
  if (!meta || typeof meta !== "object") return {};
  const o = meta as Record<string, unknown>;
  return {
    projectId: typeof o.projectId === "string" ? o.projectId.trim() : undefined,
    moduleId: typeof o.moduleId === "string" ? o.moduleId.trim() : undefined,
    slotKey: typeof o.slotKey === "string" ? o.slotKey.trim() : undefined,
    source: typeof o.source === "string" ? o.source.trim() : undefined,
  };
}

function slotHistoryHasUrl(slot: DetailPageSuiteSlot, url: string): boolean {
  if (slot.imageUrl?.trim() === url) return true;
  return (slot.imageHistory ?? []).some((h) => h.url?.trim() === url);
}

function appendImageVersion(
  slot: DetailPageSuiteSlot,
  version: DetailPageSuiteSlotImageVersion,
): DetailPageSuiteSlot {
  const prevHistory =
    Array.isArray(slot.imageHistory) && slot.imageHistory.length > 0
      ? slot.imageHistory.filter((v) => v.url?.trim())
      : slot.imageUrl?.trim()
        ? [
            {
              url: slot.imageUrl,
              assetId: slot.assetId,
              createdAt: new Date(0).toISOString(),
            },
          ]
        : [];
  const imageHistory = [...prevHistory, version];
  return {
    ...slot,
    imageUrl: version.url,
    assetId: version.assetId ?? slot.assetId,
    imageHistory,
    activeImageIndex: imageHistory.length - 1,
  };
}

export function reconcileModuleFromAssets(
  mod: DetailPageSuiteModuleState,
  byComposite: Map<string, Array<{
    id: string;
    ossUrl: string;
    prompt: string | null;
    createdAt: Date;
  }>>,
): { mod: DetailPageSuiteModuleState; recoveredImages: number; recoveredPrompts: number } {
  let slots = resolveModuleDisplaySlots(mod);
  let recoveredImages = 0;
  let recoveredPrompts = 0;
  let moduleChanged = false;

  for (const [composite, related] of byComposite) {
    const sep = composite.indexOf("::");
    if (sep <= 0) continue;
    const moduleId = composite.slice(0, sep);
    const slotKey = composite.slice(sep + 2);
    if (moduleId !== mod.module_id) continue;

    const idx = slots.findIndex((s) => s.item_key === slotKey);
    let slot = idx >= 0 ? slots[idx]! : mod.slots.find((s) => s.item_key === slotKey);
    if (!slot && mod.generate_count === 1 && slots.length === 1) {
      slot = slots[0];
    }
    if (!slot) continue;

    let slotChanged = false;
    for (const asset of related) {
      const url = asset.ossUrl?.trim();
      if (!url) continue;

      if (!slot.positive_prompt?.trim() && asset.prompt?.trim()) {
        slot = { ...slot, positive_prompt: asset.prompt.trim(), promptEdited: true };
        recoveredPrompts += 1;
        slotChanged = true;
      }

      if (!slotHistoryHasUrl(slot, url)) {
        slot = appendImageVersion(slot, {
          url,
          assetId: asset.id,
          createdAt: asset.createdAt.toISOString(),
        });
        recoveredImages += 1;
        slotChanged = true;
      }
    }

    if (!slotChanged) continue;
    moduleChanged = true;
    if (idx >= 0) {
      slots = slots.map((s, i) => (i === idx ? slot! : s));
    } else if (slots.some((s) => s.item_key === slot!.item_key)) {
      slots = slots.map((s) => (s.item_key === slot!.item_key ? slot! : s));
    } else {
      slots = [...slots, slot!];
    }
  }

  if (!moduleChanged) {
    return { mod, recoveredImages: 0, recoveredPrompts: 0 };
  }

  return {
    mod: {
      ...mod,
      slots: mergeModuleSlotsPreservingContent(mod.slots, slots),
    },
    recoveredImages,
    recoveredPrompts,
  };
}

/** 从 EcomAsset 回填缺失的出图结果与提示词（出图成功但项目 slots 未写入时） */
export async function reconcileDetailPageSuiteProjectFromAssets(
  userId: string,
  project: DetailPageSuiteProject,
): Promise<{ project: DetailPageSuiteProject; recoveredImages: number; recoveredPrompts: number }> {
  const assets = await prisma.ecomAsset.findMany({
    where: {
      userId,
      module: ECOM_DETAIL_PAGE_SUITE_MODULE,
      kind: "image",
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      ossUrl: true,
      prompt: true,
      meta: true,
      createdAt: true,
    },
  });

  const forProject = assets.filter((asset) => {
    const meta = readSuiteAssetMeta(asset.meta);
    return meta.projectId === project.id && meta.source === "detail-page-suite";
  });
  if (forProject.length === 0) {
    return { project, recoveredImages: 0, recoveredPrompts: 0 };
  }

  const byComposite = new Map<string, typeof forProject>();
  for (const asset of forProject) {
    const meta = readSuiteAssetMeta(asset.meta);
    if (!meta.moduleId || !meta.slotKey) continue;
    const key = `${meta.moduleId}::${meta.slotKey}`;
    const list = byComposite.get(key) ?? [];
    list.push(asset);
    byComposite.set(key, list);
  }
  if (byComposite.size === 0) {
    return { project, recoveredImages: 0, recoveredPrompts: 0 };
  }

  let recoveredImages = 0;
  let recoveredPrompts = 0;
  let anyChanged = false;
  const modules = project.suite.modules.map((mod) => {
    const result = reconcileModuleFromAssets(mod, byComposite);
    recoveredImages += result.recoveredImages;
    recoveredPrompts += result.recoveredPrompts;
    if (result.mod !== mod) anyChanged = true;
    return result.mod;
  });

  if (!anyChanged) {
    return { project, recoveredImages: 0, recoveredPrompts: 0 };
  }

  const suite = { ...project.suite, modules };
  const updated = await updateDetailPageSuiteProject(userId, project.id, {
    suite,
    meta: reconcileDetailPageSuitePendingMeta(suite, project.meta),
  });

  return {
    project: updated ?? project,
    recoveredImages,
    recoveredPrompts,
  };
}
