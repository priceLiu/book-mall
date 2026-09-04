import { randomUUID } from "crypto";

import { MOCK_REPLICA_PRODUCT_BRIEF } from "@/lib/ecom/ecom-media-decompose-mock-fixtures";
import {
  buildMockFilmPullRenderScript,
  MOCK_FILM_PULL_ANALYZE_PATCH,
} from "@/lib/ecom/ecom-film-pull-mock-fixtures";
import { listFilmPullProductRefs } from "@/lib/ecom/ecom-film-pull-refs";
import { formatFilmPullAnalyzeMarkdown } from "@/lib/ecom/ecom-film-pull-structured";
import type { FilmPullRenderScriptPatch } from "@/lib/ecom/ecom-film-pull-structured";
import type { FilmPullProjectDto } from "@/lib/ecom/ecom-film-pull-types";
import { isLegacyFilmPullAnalyzePatch } from "@/lib/ecom/ecom-film-pull-types";
import {
  buildRenderPlanFromScript,
  getEcomFilmPullProject,
  saveFilmPullAnalyzeResult,
  saveFilmPullRenderScriptResult,
  updateEcomFilmPullProject,
} from "@/lib/ecom/ecom-film-pull-service";

/**
 * Dev mock 拉片是否可用。
 * - 生产默认关闭
 * - 开发默认开启；`ECOM_FILM_PULL_MOCK=0` 强制关，`=1` 强制开
 */
export function isFilmPullMockAllowed(): boolean {
  const flag = process.env.ECOM_FILM_PULL_MOCK?.trim();
  if (flag === "0") return false;
  if (flag === "1") return true;
  return process.env.NODE_ENV !== "production";
}

function buildMockAnalyzeRawText(structured: typeof MOCK_FILM_PULL_ANALYZE_PATCH): string {
  const fenced = `\`\`\`film-pull\n${JSON.stringify(structured)}\n\`\`\``;
  return `${formatFilmPullAnalyzeMarkdown(structured)}\n\n${fenced}`;
}

function buildMockRenderScriptRawText(structured: FilmPullRenderScriptPatch): string {
  const fenced = `\`\`\`film-pull\n${JSON.stringify(structured)}\n\`\`\``;
  return `## 渲染脚本已生成\n\n${fenced}`;
}

function requireMockVideoUrl(project: FilmPullProjectDto): string {
  const url = project.media?.ossUrl?.trim();
  if (!url) throw new Error("请先上传或粘贴源视频");
  return url;
}

/** 写入 mock 拉片结果（不调 Gateway） */
export async function applyMockFilmPullAnalyzeResult(
  userId: string,
  projectId: string,
  opts?: { prompt?: string },
): Promise<FilmPullProjectDto> {
  if (!isFilmPullMockAllowed()) {
    throw new Error("Mock 拉片未启用（仅开发环境或 ECOM_FILM_PULL_MOCK=1）");
  }

  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  requireMockVideoUrl(project);

  const structured = MOCK_FILM_PULL_ANALYZE_PATCH;
  const rawText = buildMockAnalyzeRawText(structured);
  const prompt = opts?.prompt?.trim() || project.settings.lastAnalyzePrompt?.trim() || "【Mock 拉片】";

  await updateEcomFilmPullProject(userId, projectId, {
    settings: { ...project.settings, lastAnalyzePrompt: prompt },
    analyzeResult: null,
    renderScript: null,
    renderPlan: null,
    refMatch: null,
    productionPlan: null,
    meta: {
      ...(project.meta ?? {}),
      analyzeRunId: undefined,
      analyzeCancelRunId: null,
      analyzeStartedAt: undefined,
      finalVideoUrl: undefined,
      mediaRenderJobId: undefined,
    },
  });

  return saveFilmPullAnalyzeResult(userId, projectId, {
    rawText,
    structured,
    parseError: null,
    completedAt: new Date().toISOString(),
  });
}

/** 写入 mock 渲染脚本（不调 Gateway） */
export async function applyMockFilmPullRenderScript(
  userId: string,
  projectId: string,
): Promise<FilmPullProjectDto> {
  if (!isFilmPullMockAllowed()) {
    throw new Error("Mock 渲染脚本未启用（仅开发环境或 ECOM_FILM_PULL_MOCK=1）");
  }

  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const analyze = project.analyzeResult?.structured;
  if (!analyze) throw new Error("请先完成拉片");
  if (!isLegacyFilmPullAnalyzePatch(analyze)) {
    throw new Error("Pro2 拉片结果暂不支持 mock 渲染脚本");
  }

  const structured = buildMockFilmPullRenderScript(analyze);
  const rawText = buildMockRenderScriptRawText(structured);

  await saveFilmPullRenderScriptResult(userId, projectId, {
    rawText,
    structured,
    parseError: null,
    completedAt: new Date().toISOString(),
  });

  return buildRenderPlanFromScript(userId, projectId, structured);
}

/** Mock 批量出镜：用源视频 URL 填充各镜 videoUrl */
export async function applyMockFilmPullBatchGenerate(
  userId: string,
  projectId: string,
): Promise<FilmPullProjectDto> {
  if (!isFilmPullMockAllowed()) {
    throw new Error("Mock 批量出镜未启用（仅开发环境或 ECOM_FILM_PULL_MOCK=1）");
  }

  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const placeholder = requireMockVideoUrl(project);

  if (project.productionPlan?.shots.length) {
    const shots = project.productionPlan.shots.map((s) => ({
      ...s,
      videoUrl: placeholder,
      videoTaskId: `mock-shot-${s.shotNo}-${randomUUID().slice(0, 8)}`,
      status: "ready" as const,
    }));
    return updateEcomFilmPullProject(userId, projectId, {
      productionPlan: { ...project.productionPlan, shots },
      status: "shots_ready",
    });
  }

  const plan = project.renderPlan;
  if (!plan?.shots.length) throw new Error("请先生成制作脚本或渲染计划");

  const shots = plan.shots.map((s) => ({
    ...s,
    videoUrl: placeholder,
    videoTaskId: `mock-shot-${s.shotNo}-${randomUUID().slice(0, 8)}`,
  }));

  return updateEcomFilmPullProject(userId, projectId, {
    renderPlan: { ...plan, shots },
    status: "shots_ready",
  });
}

/** Dev mock · 复刻识产品（seed-video 参考图，不调 Gateway） */
export async function applyMockFilmPullReplicaProductRecognition(
  userId: string,
  projectId: string,
): Promise<{
  project: FilmPullProjectDto;
  seedVideo: import("@/lib/ecom/ecom-seed-video-service").EcomSeedVideoProjectDto;
  productBrief: string;
}> {
  if (!isFilmPullMockAllowed()) {
    throw new Error("Mock 识产品未启用（仅开发环境或 ECOM_FILM_PULL_MOCK=1）");
  }

  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const analyze = project.analyzeResult?.structured;
  if (!analyze) throw new Error("请先完成拉片");

  const seedVideoId =
    typeof project.meta?.replicaSeedVideoProjectId === "string"
      ? project.meta.replicaSeedVideoProjectId.trim()
      : "";
  if (!seedVideoId) throw new Error("请先开始一键复刻");

  const { getEcomSeedVideoProject, updateEcomSeedVideoProject } = await import(
    "@/lib/ecom/ecom-seed-video-service"
  );
  const { listReplicaProductRefs } = await import("@/lib/ecom/ecom-media-decompose-replica-refs");

  const seedVideo = await getEcomSeedVideoProject(userId, seedVideoId);
  if (!seedVideo) throw new Error("复刻项目不存在");
  if (listReplicaProductRefs(seedVideo.references).length === 0) {
    throw new Error("请先上传产品图");
  }

  const productBrief = MOCK_REPLICA_PRODUCT_BRIEF;
  const updatedProject = await updateEcomFilmPullProject(userId, projectId, {
    meta: { ...(project.meta ?? {}), replicaProductBrief: productBrief, productBrief },
  });
  const updatedSeed = await updateEcomSeedVideoProject(userId, seedVideo.id, {
    meta: {
      ...(seedVideo.meta ?? {}),
      replicaCollectPhase: "ready",
      replicaProductBrief: productBrief,
    },
  });
  return { project: updatedProject, seedVideo: updatedSeed, productBrief };
}

/** Dev mock · 识产品（不调 Gateway） */
export async function applyMockFilmPullProductRecognition(
  userId: string,
  projectId: string,
): Promise<{ project: FilmPullProjectDto; productBrief: string }> {
  if (!isFilmPullMockAllowed()) {
    throw new Error("Mock 识产品未启用（仅开发环境或 ECOM_FILM_PULL_MOCK=1）");
  }

  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  if (listFilmPullProductRefs(project.characterRefs).length === 0) {
    throw new Error("请先上传产品图");
  }

  const productBrief = MOCK_REPLICA_PRODUCT_BRIEF;
  const updated = await updateEcomFilmPullProject(userId, projectId, {
    meta: { ...(project.meta ?? {}), productBrief },
  });
  return { project: updated, productBrief };
}

/** Mock 合成成片：用源视频 URL 作为 finalVideoUrl */
export async function applyMockFilmPullFinalRender(
  userId: string,
  projectId: string,
): Promise<FilmPullProjectDto> {
  if (!isFilmPullMockAllowed()) {
    throw new Error("Mock 合成未启用（仅开发环境或 ECOM_FILM_PULL_MOCK=1）");
  }

  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  if (project.productionPlan?.shots.length) {
    const plan = project.productionPlan;
    const missing = plan.shots.filter((s) => !s.videoUrl?.trim());
    if (missing.length > 0) {
      throw new Error(`请先完成逐镜出镜（缺 ${missing.length} 镜）`);
    }
    const finalVideoUrl =
      plan.shots.find((s) => s.videoUrl?.trim())?.videoUrl?.trim() ??
      requireMockVideoUrl(project);
    const jobId = `mock-render-${randomUUID().slice(0, 8)}`;
    return updateEcomFilmPullProject(userId, projectId, {
      status: "completed",
      productionPlan: {
        ...plan,
        render: { jobId, finalVideoUrl },
      },
      meta: {
        ...(project.meta ?? {}),
        finalVideoUrl,
        mediaRenderJobId: jobId,
      },
    });
  }

  const plan = project.renderPlan;
  if (!plan?.shots.length) throw new Error("暂无渲染计划");
  const missing = plan.shots.filter((s) => !s.videoUrl?.trim());
  if (missing.length > 0) {
    throw new Error(`请先完成逐镜出镜（缺 ${missing.length} 镜）`);
  }

  const finalVideoUrl =
    plan.shots.find((s) => s.videoUrl?.trim())?.videoUrl?.trim() ??
    requireMockVideoUrl(project);
  const jobId = `mock-render-${randomUUID().slice(0, 8)}`;

  return updateEcomFilmPullProject(userId, projectId, {
    status: "completed",
    renderPlan: {
      ...plan,
      render: { jobId, finalVideoUrl },
    },
    meta: {
      ...(project.meta ?? {}),
      finalVideoUrl,
      mediaRenderJobId: jobId,
    },
  });
}
