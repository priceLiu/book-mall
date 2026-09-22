import {
  getDetailPageSuiteHitProject,
  updateDetailPageSuiteHitProject,
} from "@/lib/ecom/detail-page-suite/project-service";
import type { DetailPageSuiteMeta } from "@/lib/ecom/detail-page-suite/types";

import { HitDecomposeAlreadyRunningError, getHitTemplateFromProject } from "./hit-decompose-service";
import { runHitRewrite } from "./hit-llm";
import { runHitRewriteSingleSlot } from "./hit-rewrite-slot";
import { applyHitRewriteToSuite, materializeHitTemplateToSuite } from "./hit-materialize";
import { isHitSuiteModuleExcludedFromCopyRewrite } from "./hit-slot-copy-rules";
import { formatHitTemplateWarnings, normalizeHitTemplateDetailed } from "./hit-schemas";

/** 仅进度心跳：任务已结束（ready 等）时不得再写 meta，避免覆盖终态 */
export function shouldAcceptHitRewriteProgressWrite(
  status: DetailPageSuiteMeta["hitStatus"],
  extraMeta?: Partial<DetailPageSuiteMeta>,
): boolean {
  if (extraMeta != null && Object.prototype.hasOwnProperty.call(extraMeta, "hitStatus")) {
    return true;
  }
  return status === "decomposing" || status === "polishing";
}

/** 心跳停更后超过该时长仍 polishing，视为僵尸任务（LLM 进行中会持续心跳） */
const STALE_HIT_POLISHING_MS = 2 * 60 * 1000;

/** 进度心跳停更后仍卡在 polishing，视为可重新发起 */
export function isStaleHitPolishingJob(meta: DetailPageSuiteMeta | null | undefined): boolean {
  if (meta?.hitStatus !== "polishing") return false;
  const at = meta.hitProgress?.updatedAt;
  if (!at) return true;
  const age = Date.now() - Date.parse(at);
  return !Number.isFinite(age) || age > STALE_HIT_POLISHING_MS;
}

async function writeHitProgress(
  userId: string,
  projectId: string,
  progress: {
    step: "polish" | "merge";
    title: string;
    detail?: string;
    percent?: number;
  },
  extraMeta?: Partial<DetailPageSuiteMeta>,
) {
  const project = await getDetailPageSuiteHitProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  if (!shouldAcceptHitRewriteProgressWrite(project.meta?.hitStatus, extraMeta)) {
    return;
  }
  await updateDetailPageSuiteHitProject(userId, projectId, {
    meta: {
      ...(project.meta ?? {}),
      ...extraMeta,
      hitProgress: {
        ...progress,
        updatedAt: new Date().toISOString(),
      },
    },
  });
}

export async function beginHitRewriteJob(opts: {
  userId: string;
  projectId: string;
}) {
  const project = await getDetailPageSuiteHitProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const status = project.meta?.hitStatus;
  if (status === "decomposing") {
    throw new HitDecomposeAlreadyRunningError();
  }
  if (status === "polishing" && !isStaleHitPolishingJob(project.meta)) {
    throw new HitDecomposeAlreadyRunningError();
  }

  const template = getHitTemplateFromProject(project);
  if (!template) throw new Error("请先完成竞品长图拆解");

  const sellpoints = project.brief?.sellPoints?.map((s) => s.text.trim()).filter(Boolean) ?? [];
  if (sellpoints.length === 0) {
    throw new Error("请先填写新品核心卖点，再生成原创文案");
  }

  await writeHitProgress(
    opts.userId,
    opts.projectId,
    {
      step: "polish",
      title: "原创重写文案与出图提示词",
      detail: `按 ${template.component_list.length} 个卡位分配…`,
      percent: 8,
    },
    { hitStatus: "polishing", hitError: undefined },
  );

  return getDetailPageSuiteHitProject(opts.userId, opts.projectId);
}

export async function runHitRewritePipeline(opts: {
  userId: string;
  projectId: string;
  chatModelKey?: string;
}) {
  const project = await getDetailPageSuiteHitProject(opts.userId, opts.projectId);
  if (!project) return null;

  const template = getHitTemplateFromProject(project);
  if (!template) throw new Error("请先完成竞品长图拆解");

  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let heartbeatPercent = 22;
  let pipelineClosed = false;

  const stopHeartbeat = () => {
    pipelineClosed = true;
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  };

  try {
    await writeHitProgress(opts.userId, opts.projectId, {
      step: "polish",
      title: "大模型原创重写",
      detail: "结合爆款洞察、场景氛围与新品卖点…",
      percent: 18,
    });

    heartbeat = setInterval(() => {
      if (pipelineClosed) return;
      heartbeatPercent = Math.min(82, heartbeatPercent + 2);
      void writeHitProgress(opts.userId, opts.projectId, {
        step: "polish",
        title: "大模型原创重写",
        detail: "等待 Gateway 返回 JSON…",
        percent: heartbeatPercent,
      }).catch(() => undefined);
    }, 2000);

    const rewrite = await runHitRewrite({
      userId: opts.userId,
      projectId: opts.projectId,
      template,
      brief: project.brief,
      chatModelKey: opts.chatModelKey,
    });

    stopHeartbeat();

    await writeHitProgress(opts.userId, opts.projectId, {
      step: "merge",
      title: "写入套图格子",
      detail: "合并原创文案与生图提示词…",
      percent: 92,
    });

    const suiteBase = materializeHitTemplateToSuite(template, project.suite);
    const { suite, warning } = applyHitRewriteToSuite({
      suite: suiteBase,
      template,
      rewrite,
    });

    const latest = await getDetailPageSuiteHitProject(opts.userId, opts.projectId);
    const updated = await updateDetailPageSuiteHitProject(opts.userId, opts.projectId, {
      suite,
      meta: {
        ...(latest?.meta ?? project.meta ?? {}),
        hitTemplate: template,
        hitCopyParadigm: template.copy_paradigm ?? null,
        hitMarketInsight: template.market_insight ?? null,
        hitStatus: "ready",
        hitError: undefined,
        hitWarning: warning,
        hitProgress: {
          step: "merge",
          title: "生成完成",
          detail: "可到下方案格核对 Prompt 并出图",
          percent: 100,
          updatedAt: new Date().toISOString(),
        },
        phase: "images",
      },
    });
    if (!updated) throw new Error("保存失败");
    return updated;
  } catch (e) {
    stopHeartbeat();
    const msg = e instanceof Error ? e.message : "原创重写失败";
    const latest = await getDetailPageSuiteHitProject(opts.userId, opts.projectId);
    await updateDetailPageSuiteHitProject(opts.userId, opts.projectId, {
      meta: {
        ...(latest?.meta ?? project.meta ?? {}),
        hitStatus: "decomposed",
        hitError: msg,
        hitProgress: undefined,
      },
    });
    throw e;
  }
}

/** 同步整段（async:false 或旧调用） */
export async function rewriteDetailPageSuiteHit(opts: {
  userId: string;
  projectId: string;
  chatModelKey?: string;
}) {
  await beginHitRewriteJob(opts);
  const updated = await runHitRewritePipeline(opts);
  if (!updated) throw new Error("原创重写失败");
  return updated;
}

/** GET 读项目时修正「已完成但 meta 仍 polishing」的脏状态 */
export function reconcileHitRewriteProjectOnRead(
  project: Awaited<ReturnType<typeof getDetailPageSuiteHitProject>>,
): NonNullable<typeof project> {
  if (!project?.meta) return project!;
  const meta = project.meta;
  if (meta.hitStatus === "polishing" && meta.hitProgress?.percent === 100) {
    return {
      ...project,
      meta: {
        ...meta,
        hitStatus: "ready",
        hitError: undefined,
      },
    };
  }
  if (isStaleHitPolishingJob(meta)) {
    return {
      ...project,
      meta: {
        ...meta,
        hitStatus: "decomposed",
        hitError:
          meta.hitError ??
          "生成任务进度已停止更新，可能未写入完成状态。请重新点击「生成原创文案与 Prompt」。",
        hitProgress: undefined,
      },
    };
  }
  return project;
}

export async function applyHitTemplateEdit(opts: {
  userId: string;
  projectId: string;
  template: unknown;
}) {
  const project = await getDetailPageSuiteHitProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  const status = project.meta?.hitStatus;
  if (status === "decomposing") {
    throw new HitDecomposeAlreadyRunningError();
  }
  if (status === "polishing" && !isStaleHitPolishingJob(project.meta)) {
    throw new HitDecomposeAlreadyRunningError();
  }
  const { template, warnings } = normalizeHitTemplateDetailed(opts.template);
  const suite = materializeHitTemplateToSuite(template, project.suite);
  const templateWarning = formatHitTemplateWarnings(warnings);
  const updated = await updateDetailPageSuiteHitProject(opts.userId, opts.projectId, {
    suite,
    meta: {
      ...(project.meta ?? {}),
      hitTemplate: template,
      hitCopyParadigm: template.copy_paradigm ?? project.meta?.hitCopyParadigm,
      hitMarketInsight: template.market_insight ?? project.meta?.hitMarketInsight,
      hitWarning: templateWarning ?? project.meta?.hitWarning,
    },
  });
  if (!updated) throw new Error("保存失败");
  return updated;
}

export async function rewriteHitSingleSlot(opts: {
  userId: string;
  projectId: string;
  moduleId: string;
  slotKey: string;
  chatModelKey?: string;
}) {
  const project = await getDetailPageSuiteHitProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (isHitSuiteModuleExcludedFromCopyRewrite(opts.moduleId)) {
    throw new Error("尺码参考模块不支持 AI 文案重写");
  }
  const template = getHitTemplateFromProject(project);
  if (!template) throw new Error("请先完成竞品长图拆解");

  const mod = project.suite.modules.find((m) => m.module_id === opts.moduleId);
  if (!mod) throw new Error("模块不存在");
  const slotIndex = mod.slots.findIndex((s) => s.item_key === opts.slotKey);
  if (slotIndex < 0) throw new Error("点位不存在");
  const slot = mod.slots[slotIndex]!;

  const item = await runHitRewriteSingleSlot({
    userId: opts.userId,
    projectId: opts.projectId,
    template,
    brief: project.brief,
    componentId: opts.moduleId,
    slotIndex,
    itemKey: slot.item_key,
    itemLabel: slot.item_label,
    chatModelKey: opts.chatModelKey,
  });

  const slot_copy = item.slot_copy?.trim();
  const modules = project.suite.modules.map((m) => {
    if (m.module_id !== opts.moduleId) return m;
    return {
      ...m,
      slots: m.slots.map((s) => {
        if (s.item_key !== opts.slotKey) return s;
        return {
          ...s,
          item_label: item.item_label.trim() || s.item_label,
          positive_prompt: item.positive_prompt.trim(),
          negative_prompt: item.negative_prompt?.trim() || s.negative_prompt,
          ...(slot_copy
            ? { slot_copy, slot_copy_ai: slot_copy }
            : { slot_copy: undefined, slot_copy_ai: undefined }),
          promptEdited: false,
        };
      }),
    };
  });

  const updated = await updateDetailPageSuiteHitProject(opts.userId, opts.projectId, {
    suite: { ...project.suite, modules },
  });
  if (!updated) throw new Error("保存失败");
  return updated;
}

export async function resetHitTemplateToSnapshot(opts: {
  userId: string;
  projectId: string;
}) {
  const project = await getDetailPageSuiteHitProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  const raw = project.meta?.hitTemplateSnapshot;
  if (!raw) throw new Error("没有可重置的拆解快照");
  return applyHitTemplateEdit({
    userId: opts.userId,
    projectId: opts.projectId,
    template: raw,
  });
}
