import {
  getDetailPageSuiteReplicaProject,
  updateDetailPageSuiteReplicaProject,
} from "@/lib/ecom/detail-page-suite/project-service";
import type { DetailPageSuiteMeta } from "@/lib/ecom/detail-page-suite/types";
import {
  applyManualReplicaSegmentMapping,
  buildPhaseAFromInventoryAndMapping,
  countPendingReplicaSegments,
} from "@/lib/ecom/detail-page-vision-decompose/inventory-to-phase-a";
import {
  normalizeDetailPageVisionInventory,
  type ReplicaSegmentMapping,
} from "@/lib/ecom/detail-page-vision-decompose/inventory-schemas";
import { DETAIL_PAGE_VISION_MODULE_IDS } from "@/lib/ecom/detail-page-vision-decompose";

function readInventory(meta: DetailPageSuiteMeta | null | undefined) {
  const raw = meta?.replicaInventory;
  if (!raw) return null;
  return normalizeDetailPageVisionInventory(raw);
}

function readMapping(meta: DetailPageSuiteMeta | null | undefined): ReplicaSegmentMapping {
  const raw = meta?.replicaSegmentMapping;
  if (!raw || typeof raw !== "object") return {};
  return raw as ReplicaSegmentMapping;
}

export async function assignReplicaSegmentModule(opts: {
  userId: string;
  projectId: string;
  itemKey: string;
  moduleId: string | null;
}) {
  const project = await getDetailPageSuiteReplicaProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const inventory = readInventory(project.meta);
  if (!inventory) throw new Error("请先完成视觉清单拆解");

  const itemKey = opts.itemKey.trim();
  if (!inventory.segments.some((s) => s.item_key === itemKey)) {
    throw new Error(`未知 segment: ${itemKey}`);
  }

  const moduleId = opts.moduleId?.trim() || null;
  if (moduleId && !DETAIL_PAGE_VISION_MODULE_IDS.includes(moduleId)) {
    throw new Error(`无效 module_id: ${moduleId}`);
  }

  const mapping = applyManualReplicaSegmentMapping(
    readMapping(project.meta),
    itemKey,
    moduleId,
  );
  const phaseA = buildPhaseAFromInventoryAndMapping(inventory, mapping);
  const pending = countPendingReplicaSegments(inventory, mapping);
  const replicaWarning =
    pending > 0 ? `仍有 ${pending} 条画面待归类模块` : undefined;

  const updated = await updateDetailPageSuiteReplicaProject(opts.userId, opts.projectId, {
    meta: {
      ...(project.meta ?? {}),
      replicaSegmentMapping: mapping,
      replicaPhaseA: phaseA,
      replicaWarning,
    },
  });
  if (!updated) throw new Error("保存失败");
  return updated;
}
