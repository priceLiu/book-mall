import {
  getDetailPageSuiteReplicaProject,
  updateDetailPageSuiteReplicaProject,
} from "@/lib/ecom/detail-page-suite/project-service";
import type {
  DetailPageSuiteMeta,
  DetailPageSuiteReplicaProgress,
} from "@/lib/ecom/detail-page-suite/types";
import { ECOM_DETAIL_PAGE_SUITE_REPLICA_TOOL_KEY } from "@/lib/ecom/detail-page-suite/types";
import {
  buildPhaseAFromInventoryAndMapping,
  collectDecomposeTruncateWarnings,
  countPendingReplicaSegments,
  runDetailPageVisionClassify,
  runDetailPageVisionInventory,
} from "@/lib/ecom/detail-page-vision-decompose";

import { normalizeReplicaPhaseA } from "./replica-schemas";

export class ReplicaDecomposeAlreadyRunningError extends Error {
  constructor() {
    super("拆解已在进行中，请稍候刷新进度");
    this.name = "ReplicaDecomposeAlreadyRunningError";
  }
}

async function writeReplicaProgress(
  userId: string,
  projectId: string,
  meta: DetailPageSuiteMeta | null | undefined,
  progress: DetailPageSuiteReplicaProgress,
  extraMeta?: Partial<DetailPageSuiteMeta>,
) {
  await updateDetailPageSuiteReplicaProject(userId, projectId, {
    meta: {
      ...(meta ?? {}),
      ...extraMeta,
      replicaProgress: {
        ...progress,
        updatedAt: new Date().toISOString(),
      },
    },
  });
}

function assertNotInFlight(status: DetailPageSuiteMeta["replicaStatus"] | undefined) {
  if (status === "decomposing" || status === "polishing") {
    throw new ReplicaDecomposeAlreadyRunningError();
  }
}

function referenceSuiteUrls(project: {
  references: Array<{ role: string; ossUrl: string }>;
}): string[] {
  return project.references
    .filter((r) => r.role === "reference_suite")
    .map((r) => r.ossUrl)
    .filter(Boolean);
}

export type ReplicaDecomposeRunOpts = {
  userId: string;
  projectId: string;
  visionModelKey?: string;
  chatModelKey?: string;
};

/** 校验并标记 decomposing；供 API 立即返回，实际流水线在后台跑 */
export async function beginReplicaDecomposeJob(opts: ReplicaDecomposeRunOpts) {
  const project = await getDetailPageSuiteReplicaProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  assertNotInFlight(project.meta?.replicaStatus);

  const updated = await updateDetailPageSuiteReplicaProject(opts.userId, opts.projectId, {
    meta: {
      ...(project.meta ?? {}),
      replicaStatus: "decomposing",
      replicaError: undefined,
      replicaWarning: undefined,
      replicaInventory: undefined,
      replicaSegmentMapping: undefined,
      replicaPhaseA: undefined,
      replicaProgress: {
        step: "vision",
        title: "视觉清单拆解",
        detail: "自上而下扫描参考长图，列出全部画面块…",
        updatedAt: new Date().toISOString(),
      },
    },
  });
  if (!updated) throw new Error("保存失败");
  return updated;
}

/** 阶段 A0 清单 + A1 分批归类 → 衍生 replicaPhaseA（可后台执行） */
export async function runReplicaDecomposePipeline(opts: ReplicaDecomposeRunOpts) {
  const project = await getDetailPageSuiteReplicaProject(opts.userId, opts.projectId);
  if (!project) return;

  try {
    const inventory = await runDetailPageVisionInventory({
      userId: opts.userId,
      referenceImageUrls: referenceSuiteUrls(project),
      visionModelKey: opts.visionModelKey ?? project.settings.visionModelKey,
      workspaceId: project.id,
      clientPageAction: `${ECOM_DETAIL_PAGE_SUITE_REPLICA_TOOL_KEY}__inventory`,
      productDesc: project.brief?.productDesc,
    });

    const latestAfterInventory = await getDetailPageSuiteReplicaProject(
      opts.userId,
      opts.projectId,
    );
    const segmentTotal = inventory.segments.length;
    await writeReplicaProgress(
      opts.userId,
      opts.projectId,
      latestAfterInventory?.meta ?? project.meta,
      {
        step: "classify",
        title: "自动归类 12 模块",
        detail: `共 ${segmentTotal} 条画面，分批归类中…`,
      },
      { replicaInventory: inventory },
    );

    const { mapping } = await runDetailPageVisionClassify({
      userId: opts.userId,
      inventory,
      chatModelKey: opts.chatModelKey ?? project.settings.chatModelKey,
      workspaceId: project.id,
      clientPageAction: `${ECOM_DETAIL_PAGE_SUITE_REPLICA_TOOL_KEY}__classify`,
      onBatchProgress: async ({ batchIndex, batchTotal }) => {
        const latest = await getDetailPageSuiteReplicaProject(opts.userId, opts.projectId);
        await writeReplicaProgress(
          opts.userId,
          opts.projectId,
          latest?.meta ?? project.meta,
          {
            step: "classify",
            title: "自动归类 12 模块",
            detail: `归类进度 ${batchIndex}/${batchTotal}（共 ${segmentTotal} 条画面）…`,
            doneModules: batchIndex,
            totalModules: batchTotal,
          },
        );
      },
    });

    const phaseA = buildPhaseAFromInventoryAndMapping(inventory, mapping);
    normalizeReplicaPhaseA(phaseA);

    const truncateWarnings = collectDecomposeTruncateWarnings(phaseA);
    const pending = countPendingReplicaSegments(inventory, mapping);
    const warningParts: string[] = [];
    if (pending > 0) warningParts.push(`仍有 ${pending} 条画面待手动选择模块`);
    if (truncateWarnings.length) warningParts.push(truncateWarnings.join("；"));
    const mergedWarning = warningParts.length ? warningParts.join("；") : undefined;

    const latest = await getDetailPageSuiteReplicaProject(opts.userId, opts.projectId);
    const updated = await updateDetailPageSuiteReplicaProject(opts.userId, opts.projectId, {
      meta: {
        ...(latest?.meta ?? project.meta ?? {}),
        replicaInventory: inventory,
        replicaSegmentMapping: mapping,
        replicaPhaseA: phaseA,
        replicaStatus: "decomposed",
        replicaError: undefined,
        replicaWarning: mergedWarning,
        replicaProgress: undefined,
        phase: "prompts",
      },
    });
    if (!updated) throw new Error("保存失败");
    return updated;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "视觉拆解失败";
    const latest = await getDetailPageSuiteReplicaProject(opts.userId, opts.projectId);
    await updateDetailPageSuiteReplicaProject(opts.userId, opts.projectId, {
      meta: {
        ...(latest?.meta ?? project.meta ?? {}),
        replicaStatus: "error",
        replicaError: msg,
        replicaProgress: undefined,
      },
    });
    throw e;
  }
}

/** 同步拆解（兼容旧客户端）；新 UI 应走 begin + 后台 pipeline */
export async function decomposeDetailPageSuiteReplica(opts: ReplicaDecomposeRunOpts) {
  await beginReplicaDecomposeJob(opts);
  return runReplicaDecomposePipeline(opts);
}

/** @deprecated */
export async function decomposeAndPolishDetailPageSuiteReplica(opts: ReplicaDecomposeRunOpts) {
  return decomposeDetailPageSuiteReplica(opts);
}

export function getReplicaPhaseAFromProject(project: {
  meta?: DetailPageSuiteMeta | null;
}): ReturnType<typeof normalizeReplicaPhaseA> | null {
  const raw = project.meta?.replicaPhaseA;
  if (!raw) return null;
  try {
    return normalizeReplicaPhaseA(raw);
  } catch {
    return null;
  }
}
