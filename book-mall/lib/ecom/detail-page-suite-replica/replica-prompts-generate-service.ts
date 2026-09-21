import { OUTDOOR_JACKET_MODULES } from "@/lib/ecom/detail-page-suite/category-seeds";
import {
  getDetailPageSuiteReplicaProject,
  updateDetailPageSuiteReplicaProject,
} from "@/lib/ecom/detail-page-suite/project-service";
import type { DetailPageSuiteMeta } from "@/lib/ecom/detail-page-suite/types";

import {
  ReplicaDecomposeAlreadyRunningError,
  getReplicaPhaseAFromProject,
} from "./replica-decompose-service";
import { applyReplicaPolishToSuite } from "./replica-materialize";
import { runReplicaPhaseBBatch } from "./replica-llm";
import { normalizeReplicaModuleIds, REPLICA_MODULE_IDS } from "./replica-schemas";

async function writeReplicaProgress(
  userId: string,
  projectId: string,
  meta: DetailPageSuiteMeta | null | undefined,
  progress: {
    step: "polish" | "merge";
    title: string;
    detail?: string;
  },
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

function moduleNamesLabel(moduleIds: string[]): string {
  return moduleIds
    .map((id) => OUTDOOR_JACKET_MODULES.find((m) => m.module_id === id)?.module_name ?? id)
    .join("、");
}

/** 单次 LLM 批量润色所选模块（全选 12 亦为一次调用，不内部分批） */
export async function generateDetailPageSuiteReplicaPrompts(opts: {
  userId: string;
  projectId: string;
  moduleIds: string[];
  chatModelKey?: string;
}) {
  const project = await getDetailPageSuiteReplicaProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const status = project.meta?.replicaStatus;
  if (status === "decomposing" || status === "polishing") {
    throw new ReplicaDecomposeAlreadyRunningError();
  }

  const phaseA = getReplicaPhaseAFromProject(project);
  if (!phaseA) {
    throw new Error("请先完成参考长图拆解");
  }

  const moduleIds = normalizeReplicaModuleIds(opts.moduleIds);
  if (moduleIds.length === 0) {
    throw new Error("请至少选择一个有效模块");
  }

  const invalid = opts.moduleIds.filter(
    (id) => !REPLICA_MODULE_IDS.includes(id as (typeof REPLICA_MODULE_IDS)[number]),
  );
  if (invalid.length > 0) {
    throw new Error(`未知模块 id：${invalid.join(", ")}`);
  }

  await writeReplicaProgress(
    opts.userId,
    opts.projectId,
    project.meta,
    {
      step: "polish",
      title: `生成 Prompt（${moduleIds.length} 个模块，单次调用）`,
      detail: moduleNamesLabel(moduleIds),
    },
    {
      replicaStatus: "polishing",
      replicaError: undefined,
    },
  );

  let polishByModule;
  try {
    polishByModule = await runReplicaPhaseBBatch({
      userId: opts.userId,
      projectId: opts.projectId,
      phaseA,
      moduleIds,
      modelKey: opts.chatModelKey,
      brief: project.brief,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "生成 Prompt 失败";
    const latest = await getDetailPageSuiteReplicaProject(opts.userId, opts.projectId);
    await updateDetailPageSuiteReplicaProject(opts.userId, opts.projectId, {
      meta: {
        ...(latest?.meta ?? project.meta ?? {}),
        replicaStatus: phaseA ? "decomposed" : "error",
        replicaError: msg,
        replicaProgress: undefined,
      },
    });
    throw e;
  }

  await writeReplicaProgress(
    opts.userId,
    opts.projectId,
    project.meta,
    {
      step: "merge",
      title: "写入套图格子",
      detail: `合并 ${moduleIds.length} 个模块的 Prompt…`,
    },
  );

  const { suite, brief, warning } = applyReplicaPolishToSuite({
    suite: project.suite,
    phaseA,
    polishByModule,
    brief: project.brief,
    targetModuleIds: moduleIds,
  });

  const priorWarning = project.meta?.replicaWarning?.trim();
  const mergedWarning = [priorWarning, warning].filter(Boolean).join("；") || undefined;

  const beforeSave = await getDetailPageSuiteReplicaProject(opts.userId, opts.projectId);
  const updated = await updateDetailPageSuiteReplicaProject(opts.userId, opts.projectId, {
    suite,
    brief,
    meta: {
      ...(beforeSave?.meta ?? project.meta ?? {}),
      replicaPhaseA: phaseA,
      replicaStatus: "ready",
      replicaError: undefined,
      replicaWarning: mergedWarning,
      replicaProgress: undefined,
      phase: "images",
    },
  });
  if (!updated) throw new Error("保存失败");
  return updated;
}
