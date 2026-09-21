import {
  getDetailPageSuiteHitProject,
  updateDetailPageSuiteHitProject,
} from "@/lib/ecom/detail-page-suite/project-service";
import type { DetailPageSuiteMeta, DetailPageSuiteReplicaProgress } from "@/lib/ecom/detail-page-suite/types";

import { runHitParadigmDecompose } from "./hit-llm";
import { materializeHitTemplateToSuite } from "./hit-materialize";
import { formatHitTemplateWarnings, normalizeHitTemplate } from "./hit-schemas";

export class HitDecomposeAlreadyRunningError extends Error {
  constructor() {
    super("拆解已在进行中，请稍候刷新进度");
    this.name = "HitDecomposeAlreadyRunningError";
  }
}

export type HitDecomposeRunOpts = {
  userId: string;
  projectId: string;
  visionModelKey?: string;
  chatModelKey?: string;
};

function assertNotInFlight(status: DetailPageSuiteMeta["hitStatus"] | undefined) {
  if (status === "decomposing" || status === "polishing") {
    throw new HitDecomposeAlreadyRunningError();
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

async function writeHitProgress(
  userId: string,
  projectId: string,
  meta: DetailPageSuiteMeta | null | undefined,
  progress: DetailPageSuiteReplicaProgress,
  extraMeta?: Partial<DetailPageSuiteMeta>,
) {
  await updateDetailPageSuiteHitProject(userId, projectId, {
    meta: {
      ...(meta ?? {}),
      ...extraMeta,
      hitProgress: {
        ...progress,
        updatedAt: new Date().toISOString(),
      },
    },
  });
}

export async function beginHitDecomposeJob(opts: HitDecomposeRunOpts) {
  const project = await getDetailPageSuiteHitProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  assertNotInFlight(project.meta?.hitStatus);
  if (referenceSuiteUrls(project).length === 0) {
    throw new Error("请先上传竞品详情长截图");
  }

  const updated = await updateDetailPageSuiteHitProject(opts.userId, opts.projectId, {
    meta: {
      ...(project.meta ?? {}),
      hitStatus: "decomposing",
      hitError: undefined,
      hitWarning: undefined,
      hitProgress: {
        step: "vision",
        title: "拆解爆款范式",
        detail: "识别结构骨架、叙事节奏与场景氛围…",
        updatedAt: new Date().toISOString(),
      },
    },
  });
  if (!updated) throw new Error("保存失败");
  return updated;
}

export async function runHitDecomposePipeline(opts: HitDecomposeRunOpts) {
  const project = await getDetailPageSuiteHitProject(opts.userId, opts.projectId);
  if (!project) return;

  try {
    await writeHitProgress(opts.userId, opts.projectId, project.meta, {
      step: "vision",
      title: "拆解爆款范式",
      detail: "只学结构/话术/氛围，不提取竞品原文原图…",
    });

    const { template, warnings } = await runHitParadigmDecompose({
      userId: opts.userId,
      projectId: opts.projectId,
      referenceImageUrls: referenceSuiteUrls(project),
      visionModelKey: opts.visionModelKey ?? project.settings.visionModelKey,
      productDesc: project.brief?.productDesc,
    });

    const suite = materializeHitTemplateToSuite(template, project.suite);
    const hitWarning = formatHitTemplateWarnings(warnings);
    const latest = await getDetailPageSuiteHitProject(opts.userId, opts.projectId);
    const updated = await updateDetailPageSuiteHitProject(opts.userId, opts.projectId, {
      suite,
      meta: {
        ...(latest?.meta ?? project.meta ?? {}),
        hitTemplate: template,
        hitTemplateSnapshot: template,
        hitCopyParadigm: template.copy_paradigm ?? null,
        hitMarketInsight: template.market_insight ?? null,
        hitStatus: "decomposed",
        hitError: undefined,
        hitWarning,
        hitProgress: undefined,
        phase: "prompts",
      },
    });
    if (!updated) throw new Error("保存失败");
    return updated;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "爆款范式拆解失败";
    const latest = await getDetailPageSuiteHitProject(opts.userId, opts.projectId);
    await updateDetailPageSuiteHitProject(opts.userId, opts.projectId, {
      meta: {
        ...(latest?.meta ?? project.meta ?? {}),
        hitStatus: "error",
        hitError: msg,
        hitProgress: undefined,
      },
    });
    throw e;
  }
}

export async function decomposeDetailPageSuiteHit(opts: HitDecomposeRunOpts) {
  await beginHitDecomposeJob(opts);
  return runHitDecomposePipeline(opts);
}

export function getHitTemplateFromProject(project: {
  meta?: DetailPageSuiteMeta | null;
}): ReturnType<typeof normalizeHitTemplate> | null {
  const raw = project.meta?.hitTemplate;
  if (!raw) return null;
  try {
    return normalizeHitTemplate(raw);
  } catch {
    return null;
  }
}
