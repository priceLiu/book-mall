import { extractSellpointsFromProductImages } from "@/lib/ecom/detail-page-suite/vision-sellpoint-extract";
import type { DetailPageSuiteVisionSellpointJob } from "@/lib/ecom/detail-page-suite/types";
import { ECOM_DETAIL_PAGE_SUITE_REPLICA_TOOL_KEY } from "@/lib/ecom/detail-page-suite/types";

import {
  getDetailPageSuiteReplicaProject,
  updateDetailPageSuiteReplicaProject,
} from "@/lib/ecom/detail-page-suite/project-service";

export class ReplicaVisionSellpointAlreadyRunningError extends Error {
  constructor() {
    super("识图卖点已在进行中，请稍候刷新进度");
    this.name = "ReplicaVisionSellpointAlreadyRunningError";
  }
}

function productUrls(project: { references: Array<{ role: string; ossUrl: string }> }) {
  return project.references.filter((r) => r.role === "product").map((r) => r.ossUrl).filter(Boolean);
}

async function patchVisionJob(
  userId: string,
  projectId: string,
  job: DetailPageSuiteVisionSellpointJob,
) {
  const project = await getDetailPageSuiteReplicaProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const updated = await updateDetailPageSuiteReplicaProject(userId, projectId, {
    meta: {
      ...(project.meta ?? {}),
      replicaVisionSellpoint: job,
    },
  });
  if (!updated) throw new Error("保存失败");
  return updated;
}

async function writeProgress(
  userId: string,
  projectId: string,
  percent: number,
  title: string,
  detail?: string,
) {
  return patchVisionJob(userId, projectId, {
    status: "running",
    progress: {
      percent: Math.min(99, Math.max(0, Math.round(percent))),
      title,
      detail,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function beginReplicaVisionSellpointJob(opts: {
  userId: string;
  projectId: string;
}) {
  const project = await getDetailPageSuiteReplicaProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (project.meta?.replicaVisionSellpoint?.status === "running") {
    throw new ReplicaVisionSellpointAlreadyRunningError();
  }
  if (productUrls(project).length === 0) {
    throw new Error("请先上传至少 1 张产品图");
  }

  return patchVisionJob(opts.userId, opts.projectId, {
    status: "running",
    progress: {
      percent: 5,
      title: "准备识图卖点",
      detail: "读取产品图…",
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function runReplicaVisionSellpointPipeline(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
}) {
  const project = await getDetailPageSuiteReplicaProject(opts.userId, opts.projectId);
  if (!project) return null;

  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let heartbeatPercent = 28;

  try {
    const urls = productUrls(project);
    await writeProgress(
      opts.userId,
      opts.projectId,
      12,
      "准备识图卖点",
      `已加载 ${urls.length} 张产品图`,
    );
    await writeProgress(
      opts.userId,
      opts.projectId,
      22,
      "Vision 模型识图中",
      "分析版型、面料与工艺…",
    );

    heartbeat = setInterval(() => {
      heartbeatPercent = Math.min(78, heartbeatPercent + 2);
      void writeProgress(
        opts.userId,
        opts.projectId,
        heartbeatPercent,
        "Vision 模型识图中",
        "等待 Gateway 返回…",
      ).catch(() => undefined);
    }, 1800);

    const sellPoints = await extractSellpointsFromProductImages({
      userId: opts.userId,
      projectId: opts.projectId,
      toolKey: ECOM_DETAIL_PAGE_SUITE_REPLICA_TOOL_KEY,
      clientPageSuffix: `${ECOM_DETAIL_PAGE_SUITE_REPLICA_TOOL_KEY}__vision`,
      productUrls: urls,
      productDesc: project.brief?.productDesc,
      modelKey: opts.modelKey,
      settingsVisionModelKey: project.settings.visionModelKey,
    });

    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }

    await writeProgress(
      opts.userId,
      opts.projectId,
      88,
      "整理卖点条目",
      `共 ${sellPoints.length} 条`,
    );

    const latest = await getDetailPageSuiteReplicaProject(opts.userId, opts.projectId);
    if (!latest) throw new Error("项目不存在");
    const updated = await updateDetailPageSuiteReplicaProject(opts.userId, opts.projectId, {
      brief: { ...(latest.brief ?? {}), sellPoints, sellpointsLocked: false },
      meta: {
        ...(latest.meta ?? {}),
        replicaVisionSellpoint: {
          status: "done",
          progress: {
            percent: 100,
            title: "识图完成",
            detail: `已写入 ${sellPoints.length} 条卖点`,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });
    if (!updated) throw new Error("保存失败");
    return updated;
  } catch (e) {
    if (heartbeat) clearInterval(heartbeat);
    const msg = e instanceof Error ? e.message : "识图失败";
    await patchVisionJob(opts.userId, opts.projectId, {
      status: "error",
      error: msg,
      progress: {
        percent: 0,
        title: "识图失败",
        detail: msg,
        updatedAt: new Date().toISOString(),
      },
    });
    throw e;
  }
}
