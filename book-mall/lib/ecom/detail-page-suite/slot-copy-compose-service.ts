import { composeEcomCopyOverlayImage } from "@/lib/ecom/copy-overlay/compose-image";
import type { EcomCopyOverlay } from "@private/ecom-copy-overlay";
import { prisma } from "@/lib/prisma";

import {
  getDetailPageSuiteAplusProject,
  getDetailPageSuiteHitProject,
  getDetailPageSuiteProject,
  getDetailPageSuiteReplicaProject,
  updateDetailPageSuiteAplusProject,
  updateDetailPageSuiteHitProject,
  updateDetailPageSuiteProject,
  updateDetailPageSuiteReplicaProject,
} from "./project-service";
import {
  ECOM_AI_DETAIL_PAGE_MODULE,
  ECOM_DETAIL_PAGE_SUITE_HIT_MODULE,
  ECOM_DETAIL_PAGE_SUITE_MODULE,
  ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE,
  type DetailPageSuiteProject,
  type DetailPageSuiteSlot,
} from "./types";

function appendComposedImageVersion(
  slot: DetailPageSuiteSlot,
  url: string,
  assetId: string,
  meta?: { exportTargetId?: string; platformLabel?: string },
): DetailPageSuiteSlot {
  const prevHistory =
    Array.isArray(slot.imageHistory) && slot.imageHistory.length > 0
      ? slot.imageHistory.filter((v) => v.url?.trim())
      : slot.imageUrl?.trim()
        ? [
            {
              url: slot.imageUrl.trim(),
              assetId: slot.assetId,
              createdAt: new Date(0).toISOString(),
            },
          ]
        : [];
  const version = {
    url,
    assetId,
    createdAt: new Date().toISOString(),
    ...(meta?.exportTargetId ? { exportTargetId: meta.exportTargetId } : {}),
    ...(meta?.platformLabel ? { platformLabel: meta.platformLabel } : {}),
  };
  const imageHistory = [...prevHistory, version];
  return {
    ...slot,
    imageUrl: url,
    assetId,
    imageHistory,
    activeImageIndex: imageHistory.length - 1,
  };
}

type SuiteProjectAccess = {
  get: (userId: string, projectId: string) => Promise<DetailPageSuiteProject | null>;
  update: (
    userId: string,
    projectId: string,
    patch: Parameters<typeof updateDetailPageSuiteProject>[2],
  ) => Promise<DetailPageSuiteProject | null>;
  assetModule: string;
};

function resolveSuiteProjectAccess(projectModule?: string): SuiteProjectAccess {
  const moduleKey = projectModule?.trim() || ECOM_DETAIL_PAGE_SUITE_MODULE;
  if (moduleKey === ECOM_DETAIL_PAGE_SUITE_HIT_MODULE) {
    return {
      get: getDetailPageSuiteHitProject,
      update: updateDetailPageSuiteHitProject,
      assetModule: ECOM_DETAIL_PAGE_SUITE_HIT_MODULE,
    };
  }
  if (moduleKey === ECOM_AI_DETAIL_PAGE_MODULE) {
    return {
      get: getDetailPageSuiteAplusProject,
      update: updateDetailPageSuiteAplusProject,
      assetModule: ECOM_AI_DETAIL_PAGE_MODULE,
    };
  }
  if (moduleKey === ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE) {
    return {
      get: getDetailPageSuiteReplicaProject,
      update: updateDetailPageSuiteReplicaProject,
      assetModule: ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE,
    };
  }
  return {
    get: getDetailPageSuiteProject,
    update: updateDetailPageSuiteProject,
    assetModule: ECOM_DETAIL_PAGE_SUITE_MODULE,
  };
}

export async function composeDetailPageSuiteHitSlotCopy(opts: {
  userId: string;
  projectId: string;
  moduleId: string;
  slotKey: string;
  baseImageUrl: string;
  overlay: EcomCopyOverlay;
  slotCopy?: string;
  persistOverlay?: boolean;
}) {
  return composeDetailPageSuiteSlotCopy({
    ...opts,
    projectModule: ECOM_DETAIL_PAGE_SUITE_HIT_MODULE,
  });
}

/** 底图 + 排版 JSON → 写入点位历史并更新项目（详情页套图全系列共用） */
export async function composeDetailPageSuiteSlotCopy(opts: {
  userId: string;
  projectId: string;
  moduleId: string;
  slotKey: string;
  baseImageUrl: string;
  overlay: EcomCopyOverlay;
  slotCopy?: string;
  persistOverlay?: boolean;
  projectModule?: string;
}): Promise<{ url: string; project: DetailPageSuiteProject }> {
  const access = resolveSuiteProjectAccess(opts.projectModule);
  const project = await access.get(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const mod = project.suite.modules.find((m) => m.module_id === opts.moduleId);
  if (!mod) throw new Error("模块不存在");
  const slotIndex = mod.slots.findIndex((s) => s.item_key === opts.slotKey);
  if (slotIndex < 0) throw new Error("点位不存在");

  const { url, overlay } = await composeEcomCopyOverlayImage({
    userId: opts.userId,
    baseImageUrl: opts.baseImageUrl,
    overlay: opts.overlay,
    syncText: opts.slotCopy,
  });

  const copyTrim = opts.slotCopy?.trim();
  const slotTitle = `${mod.module_name} · ${mod.slots[slotIndex]!.item_label}`.slice(0, 80);
  const asset = await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      module: access.assetModule,
      kind: "image",
      title: slotTitle,
      prompt: mod.slots[slotIndex]!.positive_prompt,
      ossUrl: url,
      thumbnailUrl: url,
      meta: {
        projectId: opts.projectId,
        source: access.assetModule,
        moduleId: opts.moduleId,
        slotKey: opts.slotKey,
        composedCopyOverlay: true,
      },
    },
  });

  const modules = project.suite.modules.map((m) => {
    if (m.module_id !== opts.moduleId) return m;
    const slots = m.slots.map((s, i) => {
      if (i !== slotIndex) return s;
      let next: DetailPageSuiteSlot = appendComposedImageVersion(s, url, asset.id);
      if (opts.persistOverlay !== false) {
        next = {
          ...next,
          copy_overlay: overlay,
          burn_copy_in_image: false,
          ...(copyTrim ? { slot_copy: copyTrim, slot_copy_ai: s.slot_copy_ai ?? copyTrim } : {}),
        };
      }
      return next;
    });
    return { ...m, slots };
  });

  const updated = await access.update(opts.userId, opts.projectId, {
    suite: { ...project.suite, modules },
  });
  if (!updated) throw new Error("保存失败");
  return { url, project: updated };
}