import { FASHION_DIMENSION_STEPS, buildFashionDimensionsFromChat, fashionDimensionPrompt, mergeFashionDimensionSources } from "@/lib/fashion-dimensions";
import {
  buildProDimensionsFromChat,
  getDimensionSteps,
  mergeProDimensionSources,
  proDimensionPrompt,
  resolveDimensionStepOptions,
} from "@/lib/pro-vertical/dimensions";
import {
  extractProDeliverableFromText,
  hasMeaningfulProOpsPack,
  listProStoryboardVersionKeys,
  mergeProDeliverableState,
  readMetaProDeliverable,
} from "@/lib/pro-vertical/deliverable-parse";
import { getProVerticalConfig } from "@/lib/pro-vertical/registry";
import {
  getProjectVertical,
  hasProProductRef,
  isAwaitingProCategoryPick,
  isBagsProject,
  isNonFashionProVertical,
  usesProPhase,
  isCharacterRefRequired,
  getProjectCharacterRefPolicy,
  isProModeProject,
  isProVerticalProject,
} from "@/lib/pro-vertical/project-vertical";
import {
  PRO_CATEGORY_OPTIONS,
  PRO_CATEGORY_PICK_HINT,
  PRO_GENERIC_WELCOME,
  parseProCategoryPick,
  proCategoryChoiceLabel,
} from "@/lib/pro-vertical/categories";
import type { ProDeliverable, ProPanelRow, ProVerticalId } from "@/lib/pro-vertical/types";
import { isProDeliverable } from "@/lib/pro-vertical/types";
import {
  extractFashionDeliverableFromText,
  mergeFashionDeliverableState,
} from "@/lib/fashion-deliverable-parse";
import { asStoryboardDeliverable } from "@/lib/storyboard-deliverable-parse";
import type {
  FashionDeliverable,
  FashionPanelRow,
  FashionPhase,
  FashionSellpoint,
  FashionVersionKey,
} from "@/lib/fashion-types";
import { isFashionDeliverable } from "@/lib/fashion-types";
import type { StoryboardProject, StoryboardChatMessage } from "@/lib/storyboard-types";
import {
  STORYBOARD_GENERATE_FULL_VIDEO_CHOICE,
  hasSheetImagesReady,
} from "@/lib/storyboard-workflow";

export const FASHION_PRODUCT_REF_ACK = "已上传产品图";
export const FASHION_CUSTOM_DIMENSION_CHOICE = "自定义";
export const FASHION_AI_SELLPOINTS = "fashion-step:sellpoints-generate";
export const FASHION_AI_VOICEOVERS = "fashion-step:voiceovers-generate";
export const FASHION_AI_STORYBOARDS = "fashion-step:storyboards-generate";
export const FASHION_AI_OPS = "fashion-step:ops-generate";
export const FASHION_AI_SELLPOINTS_CHOICE = "AI自动生成卖点";
export const FASHION_LOCK_SELLPOINTS = "确认卖点清单";
export const FASHION_OUTPUT_SCRIPT = "分镜脚本交付";
export const FASHION_OUTPUT_VIDEO = "故事版一键成片";
export const FASHION_REGENERATE_SELLPOINTS = "重新生成卖点";
export const FASHION_REGENERATE_VOICEOVERS = "重新生成口播文案";
export const FASHION_REGENERATE_STORYBOARDS = "重新生成分镜";
export const FASHION_GENERATE_STORYBOARDS_LABEL = "生成 A–E 分镜方案";
export const FASHION_CONFIRM_STORYBOARD = "确认分镜，生成运营包";
export const FASHION_REGENERATE_OPS = "重新生成运营包";
export const FASHION_REPICK_STORYBOARD = "重新选择分镜版本";

export const PRO_AI_SELLPOINTS = "pro-step:sellpoints-generate";
export const PRO_AI_VOICEOVERS = "pro-step:voiceovers-generate";
export const PRO_AI_STORYBOARDS = "pro-step:storyboards-generate";
export const PRO_AI_OPS = "pro-step:ops-generate";

export type FashionBusyStatus = {
  title: string;
  detail: string;
};

export function fashionBusyStatusForUserMessage(message: string): FashionBusyStatus {
  const trimmed = message.trim();
  if (trimmed === FASHION_LOCK_SELLPOINTS) {
    return {
      title: "正在确认卖点",
      detail: "卖点已定稿，AI 正在生成 6 套口播文案，约需 30–60 秒…",
    };
  }
  if (trimmed === FASHION_AI_SELLPOINTS_CHOICE || trimmed === FASHION_REGENERATE_SELLPOINTS) {
    return {
      title: "正在生成卖点",
      detail: "AI 正在分析七维参数并输出分层卖点，请稍候…",
    };
  }
  if (trimmed.startsWith("选择口播")) {
    return {
      title: "正在生成分镜",
      detail: "已选定口播，AI 正在生成 A–E 五套分镜脚本，约需 1–2 分钟…",
    };
  }
  if (trimmed.startsWith("选择分镜")) {
    return {
      title: "已选定分镜",
      detail: "请查看左侧 12.1 分镜脚本表与验收清单，确认后继续…",
    };
  }
  if (trimmed === FASHION_CONFIRM_STORYBOARD || trimmed === FASHION_REGENERATE_OPS) {
    return {
      title: "正在生成运营包",
      detail: "已确认分镜定稿，AI 正在生成标题、标签与详情文案…",
    };
  }
  if (trimmed === FASHION_REPICK_STORYBOARD) {
    return {
      title: "重新选版",
      detail: "已清除当前选定，请重新选择 A–E 分镜方案…",
    };
  }
  if (trimmed === FASHION_REGENERATE_STORYBOARDS) {
    return {
      title: "正在重新生成分镜",
      detail: "AI 正在重新输出 A–E 五套分镜脚本，请稍候…",
    };
  }
  if (trimmed === FASHION_REGENERATE_VOICEOVERS) {
    return {
      title: "正在重新生成口播",
      detail: "AI 正在重新输出 6 套口播文案，请稍候…",
    };
  }
  if (trimmed === FASHION_OUTPUT_SCRIPT || trimmed === FASHION_OUTPUT_VIDEO) {
    return {
      title: "正在同步分镜表",
      detail: "正在将定稿分镜写入左侧工作台…",
    };
  }
  if (trimmed === FASHION_CUSTOM_DIMENSION_CHOICE) {
    return {
      title: "等待输入",
      detail: "请在下方输入框填写自定义内容后发送。",
    };
  }
  return {
    title: "处理中",
    detail: "正在保存您的选择，请稍候…",
  };
}

export function fashionBusyStatusForLlmTrigger(trigger: string): FashionBusyStatus {
  if (trigger.includes("sellpoints")) {
    return fashionBusyStatusForUserMessage(FASHION_AI_SELLPOINTS_CHOICE);
  }
  if (trigger.includes("voiceovers")) {
    return fashionBusyStatusForUserMessage(FASHION_LOCK_SELLPOINTS);
  }
  if (trigger.includes("storyboards")) {
    return {
      title: "正在生成分镜",
      detail: "AI 正在输出 A–E 五套分镜 JSON（体积较大，通常需 2–8 分钟）…",
    };
  }
  if (trigger.includes("ops")) {
    return { title: "正在生成运营包", detail: "AI 正在生成标题、标签与详情文案…" };
  }
  return { title: "生成中", detail: "AI 正在处理，请稍候…" };
}

/** 内部 LLM 步骤 · 流式总时长上限 */
export function fashionLlmStreamTimeoutMs(trigger: string): number {
  if (trigger.includes("storyboards")) return 12 * 60_000;
  if (trigger.includes("ops")) return 8 * 60_000;
  if (trigger.includes("voiceovers")) return 6 * 60_000;
  return 5 * 60_000;
}

/** 流式无新内容超过该时长则判定卡住 */
export function fashionLlmStreamIdleTimeoutMs(trigger: string): number {
  if (trigger.includes("storyboards")) return 3 * 60_000;
  return 2 * 60_000;
}

/** 流结束后校验服务端是否已写入预期 deliverable 字段 */
export function fashionLlmTriggerSucceeded(
  trigger: string,
  project: StoryboardProject,
): boolean {
  const d = resolveProVerticalDeliverable(project);
  if (!d) return false;
  if (trigger.includes("sellpoints")) return (d.sellpoints?.length ?? 0) > 0;
  if (trigger.includes("voiceovers")) return (d.voiceovers?.length ?? 0) > 0;
  if (trigger.includes("storyboards")) {
    if (isProDeliverable(d) && d.vertical !== "fashion_apparel") {
      return listProStoryboardVersionKeys(d).length > 0;
    }
    return listFashionStoryboardVersionKeys(d).length > 0;
  }
  if (trigger.includes("ops")) return hasMeaningfulDeliverableOpsPack(d);
  return true;
}

export type FashionWorkflowMeta = {
  vertical?: "fashion_apparel" | "bags" | "digital_3c";
  fashionPhase?: FashionPhase;
  proPhase?: FashionPhase;
  dimensionStep?: number;
  productName?: string;
  initialProductRefAcknowledged?: boolean;
  awaitingProductName?: boolean;
  /** 七维选项步点「自定义」后，等待用户在输入框填写 */
  awaitingFashionCustomDimension?: boolean;
  /** 用户在中栏表格手动改过卖点，resolve 时以 meta.deliverable 为准 */
  fashionSellpointsEdited?: boolean;
  proSellpointsEdited?: boolean;
  /** 用户在中栏修改过已定稿分镜表，resolve 时以 meta.deliverable 为准 */
  fashionStoryboardPanelsEdited?: boolean;
  proStoryboardPanelsEdited?: boolean;
  /** 路径 B 进入 produce 后，须先选生图模型与角色参考方式 */
  fashionProduceSetupPending?: boolean;
  proProduceSetupPending?: boolean;
  /** 路径 B 成片阶段选定的生图模型 */
  fashionImageModelKey?: string;
  proImageModelKey?: string;
  /** 角色参考：AI 生成 / 用户上传 */
  fashionCharacterMode?: "ai" | "upload";
  proCharacterMode?: "ai" | "upload";
};

export type FashionChoice = {
  id: string;
  title: string;
  description?: string;
  message: string;
  recommended?: boolean;
};

export function isFashionProject(project: StoryboardProject): boolean {
  return getProjectVertical(project) === "fashion_apparel";
}

export {
  isProVerticalProject,
  isBagsProject,
  isNonFashionProVertical,
  usesProPhase,
  isCharacterRefRequired,
  getProjectCharacterRefPolicy,
  getProjectVertical,
  isProModeProject,
  isAwaitingProCategoryPick,
  hasProProductRef,
};

function dimensionStepsForProject(project: StoryboardProject) {
  const vertical = getProjectVertical(project) ?? "fashion_apparel";
  return getDimensionSteps(vertical);
}

function workflowPhaseKey(project: StoryboardProject): "fashionPhase" | "proPhase" {
  if (usesProPhase(project)) return "proPhase";
  return "fashionPhase";
}

function deliverableSchemaForProject(project: StoryboardProject): "pro-v1" | "fashion-v4" {
  const vertical = getProjectVertical(project) ?? "fashion_apparel";
  const config = getProVerticalConfig(vertical);
  return config?.schemaVersion === "pro-v1" ? "pro-v1" : "fashion-v4";
}

function llmTriggerFor(
  project: StoryboardProject,
  step: "sellpoints" | "voiceovers" | "storyboards" | "ops",
): string {
  return usesProPhase(project) ? `pro-step:${step}-generate` : `fashion-step:${step}-generate`;
}

function phaseWorkflowPatch(project: StoryboardProject, phase: FashionPhase): Record<string, unknown> {
  return { [workflowPhaseKey(project)]: phase };
}

function hasMeaningfulDeliverableOpsPack(
  d: FashionDeliverable | ProDeliverable | null | undefined,
): boolean {
  if (!d) return false;
  if (isProDeliverable(d) && d.vertical !== "fashion_apparel") return hasMeaningfulProOpsPack(d);
  return hasMeaningfulOpsPack(d as FashionDeliverable);
}

/** 七维参数拼接为故事版「项目关键词」 */
export function buildFashionProjectKeywords(
  deliverable: Pick<FashionDeliverable, "dimensions"> | null | undefined,
): string {
  const d = deliverable?.dimensions ?? {};
  return [
    d.styleCategory,
    d.styleAttribute,
    d.platform,
    d.customScene,
  ]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .join(" · ");
}

export function fashionProduceImageModelKey(project: StoryboardProject): string | undefined {
  const wf = getFashionWorkflowMeta(project);
  return wf.fashionImageModelKey?.trim() || undefined;
}

export function fashionCharacterMode(
  project: StoryboardProject,
): "ai" | "upload" | undefined {
  const wf = getFashionWorkflowMeta(project);
  return wf.proCharacterMode ?? wf.fashionCharacterMode;
}

export function isFashionProduceSetupReady(project: StoryboardProject): boolean {
  const d = resolveProVerticalDeliverable(project);
  if (d?.outputMode !== "direct_video") return true;
  const policy = getProjectCharacterRefPolicy(project);
  if (policy !== "required") return true;
  const wf = getFashionWorkflowMeta(project);
  const pending = wf.proProduceSetupPending ?? wf.fashionProduceSetupPending;
  if (pending === false) return true;
  const charMode = wf.proCharacterMode ?? wf.fashionCharacterMode;
  return charMode === "ai" || charMode === "upload";
}

/** sheet 脚本字段缺失但 deliverable 有内容时需 re-sync */
export function fashionSheetNeedsScriptResync(project: StoryboardProject): boolean {
  const d = workflowDeliverable(project);
  if (d?.outputMode !== "direct_video" || !project.sheet?.panels?.length) return false;
  const key = d.selectedVersion;
  if (!key) return false;
  const panels = d.storyboardVersions?.[key]?.panels;
  if (!panels?.length) return false;
  const sheetEmpty = project.sheet.panels.some(
    (p) =>
      !p.scene?.trim() ||
      p.scene === "—" ||
      !p.dialogue?.trim(),
  );
  const deliverableHasScript = panels.some(
    (p) => Boolean(p.sceneDesc?.trim() && p.sceneDesc !== "—") || Boolean(p.dialogue?.trim()),
  );
  return sheetEmpty && deliverableHasScript;
}

export function isLegacyStoryboardProject(project: StoryboardProject): boolean {
  if (isProModeProject(project)) return false;
  if (isFashionProject(project)) return false;
  const d = project.meta?.deliverable;
  if (d && isFashionDeliverable(d)) return false;
  const sb = asStoryboardDeliverable(d);
  return Boolean(
    sb?.schemes?.length ||
      sb?.analysis ||
      project.sheet ||
      project.chatHistory.length > 1,
  );
}

/** 口播选版须出现在最近一次卖点定稿且 assistant 已返回 voiceovers 之后 */
export function parseFashionVoiceoverPickFromChat(
  chatHistory: StoryboardChatMessage[],
): string | null {
  let voiceoversReady = false;
  let picked: string | null = null;
  for (const msg of chatHistory) {
    if (msg?.role === "user") {
      const trimmed = msg.content.trim();
      if (trimmed === FASHION_LOCK_SELLPOINTS || trimmed === FASHION_REGENERATE_VOICEOVERS) {
        voiceoversReady = false;
        picked = null;
        continue;
      }
      if (voiceoversReady) {
        const m = trimmed.match(/^选择口播\s*(V\d+)/);
        if (m?.[1]) picked = m[1];
      }
      continue;
    }
    if (msg?.role === "assistant") {
      const parsed =
        extractFashionDeliverableFromText(msg.content) ??
        extractProDeliverableFromText(msg.content);
      if ((parsed?.voiceovers?.length ?? 0) > 0) {
        voiceoversReady = true;
      }
    }
  }
  return picked;
}

export function hasFashionVoiceoversInChat(chatHistory: StoryboardChatMessage[]): boolean {
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const msg = chatHistory[i];
    if (msg?.role !== "assistant") continue;
    const parsed = extractFashionDeliverableFromText(msg.content);
    if ((parsed?.voiceovers?.length ?? 0) > 0) return true;
  }
  return false;
}

function parseFashionVersionPickFromChat(
  chatHistory: StoryboardChatMessage[],
): FashionVersionKey | null {
  let picked: FashionVersionKey | null = null;
  for (const msg of chatHistory) {
    if (msg?.role !== "user") continue;
    const m = msg.content.trim().match(/^选择分镜\s*([A-E])版/);
    if (m?.[1]) picked = m[1] as FashionVersionKey;
  }
  return picked;
}

export type FashionWorkflowChoiceMessageLabel = {
  label: string;
  detail: string;
};

/** 口播 / 分镜选版等 workflow 用户选择的会话标签 */
export function buildFashionWorkflowChoiceMessageLabels(
  messages: Array<{ id: string; role: string; content: string }>,
): Map<string, FashionWorkflowChoiceMessageLabel> {
  const labels = new Map<string, FashionWorkflowChoiceMessageLabel>();
  for (const m of messages) {
    if (m.role !== "user") continue;
    const trimmed = m.content.trim();
    const voiceover = trimmed.match(/^选择口播\s*(V\d+)(?:：(.*))?/);
    if (voiceover) {
      labels.set(m.id, {
        label: "口播文案",
        detail: `已选 ${voiceover[1]}${voiceover[2] ? ` · ${voiceover[2].trim()}` : ""}`,
      });
      continue;
    }
    const version = trimmed.match(/^选择分镜\s*([A-E])版(?:：(.*))?/);
    if (version) {
      labels.set(m.id, {
        label: "分镜方案",
        detail: `已选 ${version[1]}版${version[2] ? ` · ${version[2].trim()}` : ""}`,
      });
      continue;
    }
    if (trimmed === FASHION_CONFIRM_STORYBOARD) {
      labels.set(m.id, {
        label: "分镜定稿",
        detail: "已确认分镜脚本，生成运营包",
      });
      continue;
    }
  }
  return labels;
}

function hasMeaningfulOpsPack(d: FashionDeliverable | null | undefined): boolean {
  const ops = d?.opsPack;
  if (!ops) return false;
  return Boolean(
    (ops.titles?.length ?? 0) > 0 ||
      (ops.coverWords?.length ?? 0) > 0 ||
      (ops.tags?.length ?? 0) > 0 ||
      (ops.detailBullets?.length ?? 0) > 0 ||
      Boolean(ops.xiaohongshuBody?.trim()),
  );
}

function applyFashionDeliverablePhaseGuards(
  deliverable: FashionDeliverable,
  project: StoryboardProject,
): FashionDeliverable {
  let next = deliverable;
  const metaDeliverable = isFashionDeliverable(project.meta?.deliverable)
    ? (project.meta!.deliverable as FashionDeliverable)
    : null;

  if (!next.sellpointsLocked) {
    return {
      ...next,
      voiceovers: [],
      selectedVoiceoverId: null,
      storyboardVersions: {},
      selectedVersion: null,
      coverageChecklist: [],
      opsPack: undefined,
      outputMode: null,
    };
  }

  const voiceoversReady = (next.voiceovers?.length ?? 0) > 0;
  const voiceoverPickedFromChat = parseFashionVoiceoverPickFromChat(project.chatHistory);
  if (voiceoversReady && voiceoverPickedFromChat) {
    next = { ...next, selectedVoiceoverId: voiceoverPickedFromChat };
  } else if (metaDeliverable?.selectedVoiceoverId) {
    next = { ...next, selectedVoiceoverId: metaDeliverable.selectedVoiceoverId };
  } else {
    next = { ...next, selectedVoiceoverId: null };
  }

  if (!next.selectedVoiceoverId) {
    return {
      ...next,
      storyboardVersions: {},
      selectedVersion: null,
      coverageChecklist: [],
      opsPack: undefined,
      outputMode: null,
    };
  }

  if (!next.selectedVoiceoverId) {
    return {
      ...next,
      storyboardVersions: {},
      selectedVersion: null,
      coverageChecklist: [],
      opsPack: undefined,
      outputMode: null,
    };
  }

  // 先剥离 LLM 预填运营包，避免误判「已选版 + 有运营包」而跳到路径 A/B
  if (!next.storyboardLocked) {
    next = { ...next, opsPack: undefined, outputMode: null };
  } else if (!hasMeaningfulOpsPack(next)) {
    next = { ...next, outputMode: null };
  }

  const versionPickedFromChat = parseFashionVersionPickFromChat(project.chatHistory);
  const wf = getFashionWorkflowMeta(project);
  const wfPhaseRank = FASHION_PHASE_RANK[wf.fashionPhase ?? "product_ref"] ?? 0;
  const metaVersionAuthoritative =
    Boolean(metaDeliverable?.selectedVersion) &&
    wfPhaseRank >= FASHION_PHASE_RANK.storyboard_confirm;

  if (versionPickedFromChat) {
    next = { ...next, selectedVersion: versionPickedFromChat };
  } else if (metaVersionAuthoritative && metaDeliverable?.selectedVersion) {
    next = { ...next, selectedVersion: metaDeliverable.selectedVersion };
  } else if (
    next.selectedVersion &&
    listFashionStoryboardVersionKeys(next).length > 0 &&
    !next.storyboardLocked
  ) {
    next = { ...next, selectedVersion: null };
  }

  if (!next.selectedVersion) {
    return {
      ...next,
      coverageChecklist: [],
      opsPack: undefined,
      outputMode: null,
    };
  }

  if (isStoryboardConfirmAfterLastVersionPick(project)) {
    next = { ...next, storyboardLocked: true };
  } else {
    next = {
      ...next,
      storyboardLocked: false,
      opsPack: undefined,
      outputMode: null,
    };
  }

  return next;
}

/** 合并 meta 权威字段（用户保存的卖点/分镜/成片方式），防止 chat repair 冲掉 */
export function applyFashionMetaAuthorityToDeliverable(
  resolved: FashionDeliverable,
  project: StoryboardProject,
): FashionDeliverable {
  const metaDeliverable = isFashionDeliverable(project.meta?.deliverable)
    ? (project.meta!.deliverable as FashionDeliverable)
    : null;
  if (!metaDeliverable) return resolved;

  const wf = getFashionWorkflowMeta(project);
  let next: FashionDeliverable = { ...resolved };

  if (metaDeliverable.sellpoints?.length) {
    if (metaDeliverable.sellpointsLocked || wf.fashionSellpointsEdited) {
      next = {
        ...next,
        sellpoints: metaDeliverable.sellpoints,
        sellpointsLocked: metaDeliverable.sellpointsLocked || next.sellpointsLocked,
      };
    }
  }

  const storyboardAuthoritative = isStoryboardConfirmAfterLastVersionPick(project);

  const versionKey =
    (next.selectedVersion ??
      metaDeliverable.selectedVersion ??
      parseFashionVersionPickFromChat(project.chatHistory)) as FashionVersionKey | null | undefined;
  if (versionKey) {
    const panels = resolveFashionStoryboardPanelsForVersion(project, versionKey, next);
    if (panels?.length) {
      const versionMeta =
        metaDeliverable.storyboardVersions?.[versionKey] ??
        next.storyboardVersions?.[versionKey] ?? {
          id: versionKey,
          title: `${versionKey}版`,
          panels: [],
        };
      next = {
        ...next,
        selectedVersion: versionKey,
        storyboardLocked:
          storyboardAuthoritative &&
          (metaDeliverable.storyboardLocked || next.storyboardLocked),
        storyboardVersions: {
          ...(next.storyboardVersions ?? {}),
          [versionKey]: { ...versionMeta, panels },
        },
      };
    } else if (
      metaDeliverable.selectedVersion === versionKey &&
      getFashionPhase(project) === "storyboard_confirm"
    ) {
      next = {
        ...next,
        selectedVersion: versionKey,
        storyboardLocked:
          storyboardAuthoritative &&
          (metaDeliverable.storyboardLocked || next.storyboardLocked),
      };
    }
  }

  if (storyboardAuthoritative && metaDeliverable.storyboardLocked) {
    next.storyboardLocked = true;
  }
  if (storyboardAuthoritative && hasMeaningfulOpsPack(metaDeliverable)) {
    next.opsPack = metaDeliverable.opsPack;
  }
  if (hasFashionOutputModeChoiceInChat(project) && metaDeliverable.outputMode) {
    next.outputMode = metaDeliverable.outputMode;
  }

  return next;
}

function applyProDeliverablePhaseGuards(
  deliverable: ProDeliverable,
  project: StoryboardProject,
): ProDeliverable {
  let next = deliverable;
  const metaDeliverable = isProDeliverable(project.meta?.deliverable)
    ? (project.meta!.deliverable as ProDeliverable)
    : null;
  const wf = getFashionWorkflowMeta(project);
  const wfPhase = wf.proPhase ?? wf.fashionPhase ?? "product_ref";

  if (!next.sellpointsLocked) {
    return {
      ...next,
      voiceovers: [],
      selectedVoiceoverId: null,
      storyboardVersions: {},
      selectedVersion: null,
      coverageChecklist: [],
      opsPack: undefined,
      outputMode: null,
    };
  }

  const voiceoversReady = (next.voiceovers?.length ?? 0) > 0;
  const voiceoverPickedFromChat = parseFashionVoiceoverPickFromChat(project.chatHistory);
  if (voiceoversReady && voiceoverPickedFromChat) {
    next = { ...next, selectedVoiceoverId: voiceoverPickedFromChat };
  } else if (metaDeliverable?.selectedVoiceoverId) {
    next = { ...next, selectedVoiceoverId: metaDeliverable.selectedVoiceoverId };
  } else {
    next = { ...next, selectedVoiceoverId: null };
  }

  if (!next.selectedVoiceoverId) {
    return {
      ...next,
      storyboardVersions: {},
      selectedVersion: null,
      coverageChecklist: [],
      opsPack: undefined,
      outputMode: null,
    };
  }

  if (!next.storyboardLocked) {
    next = { ...next, opsPack: undefined, outputMode: null };
  } else if (!hasMeaningfulProOpsPack(next)) {
    next = { ...next, outputMode: null };
  }

  const versionPickedFromChat = parseFashionVersionPickFromChat(project.chatHistory);
  const wfPhaseRank = FASHION_PHASE_RANK[wfPhase] ?? 0;
  const metaVersionAuthoritative =
    Boolean(metaDeliverable?.selectedVersion) &&
    wfPhaseRank >= FASHION_PHASE_RANK.storyboard_confirm;

  if (versionPickedFromChat) {
    next = { ...next, selectedVersion: versionPickedFromChat };
  } else if (metaVersionAuthoritative && metaDeliverable?.selectedVersion) {
    next = { ...next, selectedVersion: metaDeliverable.selectedVersion };
  } else if (
    next.selectedVersion &&
    listProStoryboardVersionKeys(next).length > 0 &&
    !next.storyboardLocked
  ) {
    next = { ...next, selectedVersion: null };
  }

  if (!next.selectedVersion) {
    return {
      ...next,
      coverageChecklist: [],
      opsPack: undefined,
      outputMode: null,
    };
  }

  if (isStoryboardConfirmAfterLastVersionPick(project)) {
    next = { ...next, storyboardLocked: true };
  } else {
    next = {
      ...next,
      storyboardLocked: false,
      opsPack: undefined,
      outputMode: null,
    };
  }

  return next;
}

function applyProMetaAuthorityToDeliverable(
  resolved: ProDeliverable,
  project: StoryboardProject,
): ProDeliverable {
  const metaDeliverable = isProDeliverable(project.meta?.deliverable)
    ? (project.meta!.deliverable as ProDeliverable)
    : null;
  if (!metaDeliverable) return resolved;

  const wf = getFashionWorkflowMeta(project);
  let next: ProDeliverable = { ...resolved };

  if (metaDeliverable.sellpoints?.length) {
    if (metaDeliverable.sellpointsLocked || wf.proSellpointsEdited) {
      next = {
        ...next,
        sellpoints: metaDeliverable.sellpoints,
        sellpointsLocked: metaDeliverable.sellpointsLocked || next.sellpointsLocked,
      };
    }
  }

  const storyboardAuthoritative = isStoryboardConfirmAfterLastVersionPick(project);

  const versionKey =
    (next.selectedVersion ??
      metaDeliverable.selectedVersion ??
      parseFashionVersionPickFromChat(project.chatHistory)) as FashionVersionKey | null | undefined;
  if (versionKey) {
    const panels = resolveProStoryboardPanelsForVersion(project, versionKey, next);
    if (panels?.length) {
      const versionMeta =
        metaDeliverable.storyboardVersions?.[versionKey] ??
        next.storyboardVersions?.[versionKey] ?? {
          id: versionKey,
          title: `${versionKey}版`,
          panels: [],
        };
      next = {
        ...next,
        selectedVersion: versionKey,
        storyboardLocked:
          storyboardAuthoritative &&
          (metaDeliverable.storyboardLocked || next.storyboardLocked),
        storyboardVersions: {
          ...(next.storyboardVersions ?? {}),
          [versionKey]: { ...versionMeta, panels },
        },
      };
    } else if (
      metaDeliverable.selectedVersion === versionKey &&
      getFashionPhase(project) === "storyboard_confirm"
    ) {
      next = {
        ...next,
        selectedVersion: versionKey,
        storyboardLocked:
          storyboardAuthoritative &&
          (metaDeliverable.storyboardLocked || next.storyboardLocked),
      };
    }
  }

  if (storyboardAuthoritative && metaDeliverable.storyboardLocked) {
    next.storyboardLocked = true;
  }
  if (storyboardAuthoritative && hasMeaningfulProOpsPack(metaDeliverable)) {
    next.opsPack = metaDeliverable.opsPack;
  }
  if (hasFashionOutputModeChoiceInChat(project) && metaDeliverable.outputMode) {
    next.outputMode = metaDeliverable.outputMode;
  }

  return next;
}

export function resolveFashionStoryboardPanelsForVersion(
  project: StoryboardProject,
  versionKey: FashionVersionKey,
  deliverable?: FashionDeliverable | null,
): FashionPanelRow[] | undefined {
  const rawDeliverable = deliverable ?? workflowDeliverable(project);
  const d =
    rawDeliverable && isFashionDeliverable(rawDeliverable) ? rawDeliverable : null;
  const metaDeliverable = isFashionDeliverable(project.meta?.deliverable)
    ? (project.meta!.deliverable as FashionDeliverable)
    : null;
  const wf = getFashionWorkflowMeta(project);

  const metaPanels = metaDeliverable?.storyboardVersions?.[versionKey]?.panels;
  const metaVersionSelected = metaDeliverable?.selectedVersion === versionKey;
  const storyboardConfirmed =
    isStoryboardConfirmAfterLastVersionPick(project) ||
    wf.fashionStoryboardPanelsEdited;
  if (
    metaPanels?.length &&
    (metaVersionSelected ||
      storyboardConfirmed ||
      getFashionPhase(project) === "storyboard_confirm")
  ) {
    return metaPanels;
  }
  if (d?.storyboardVersions?.[versionKey]?.panels?.length) {
    return d.storyboardVersions[versionKey]!.panels;
  }
  if (metaPanels?.length) return metaPanels;

  for (let i = project.chatHistory.length - 1; i >= 0; i--) {
    const msg = project.chatHistory[i];
    if (msg?.role !== "assistant") continue;
    const parsed = extractFashionDeliverableFromText(msg.content);
    const panels = parsed?.storyboardVersions?.[versionKey]?.panels;
    if (panels?.length) return panels;
  }
  return undefined;
}

export function resolveProStoryboardPanelsForVersion(
  project: StoryboardProject,
  versionKey: FashionVersionKey,
  deliverable?: ProDeliverable | null,
): ProPanelRow[] | undefined {
  const d = deliverable ?? (workflowDeliverable(project) as ProDeliverable | null);
  const metaDeliverable = isProDeliverable(project.meta?.deliverable)
    ? (project.meta!.deliverable as ProDeliverable)
    : null;
  const wf = getFashionWorkflowMeta(project);

  const metaPanels = metaDeliverable?.storyboardVersions?.[versionKey]?.panels;
  const metaVersionSelected = metaDeliverable?.selectedVersion === versionKey;
  const storyboardConfirmed =
    isStoryboardConfirmAfterLastVersionPick(project) ||
    wf.proStoryboardPanelsEdited;
  if (
    metaPanels?.length &&
    (metaVersionSelected ||
      storyboardConfirmed ||
      getFashionPhase(project) === "storyboard_confirm")
  ) {
    return metaPanels;
  }
  if (d?.storyboardVersions?.[versionKey]?.panels?.length) {
    return d.storyboardVersions[versionKey]!.panels;
  }
  if (metaPanels?.length) return metaPanels;

  for (let i = project.chatHistory.length - 1; i >= 0; i--) {
    const msg = project.chatHistory[i];
    if (msg?.role !== "assistant") continue;
    const parsed = extractProDeliverableFromText(msg.content);
    const panels = parsed?.storyboardVersions?.[versionKey]?.panels;
    if (panels?.length) return panels;
  }
  return undefined;
}

export function buildFashionDeliverableWithVersionPanels(
  project: StoryboardProject,
  deliverable: FashionDeliverable,
  versionKey: FashionVersionKey,
): FashionDeliverable {
  const panels = resolveFashionStoryboardPanelsForVersion(project, versionKey, deliverable);
  const metaDeliverable = isFashionDeliverable(project.meta?.deliverable)
    ? (project.meta!.deliverable as FashionDeliverable)
    : null;
  const versionMeta =
    deliverable.storyboardVersions?.[versionKey] ??
    metaDeliverable?.storyboardVersions?.[versionKey] ?? {
      id: versionKey,
      title: `${versionKey}版`,
      panels: [],
    };
  if (!panels?.length) return deliverable;
  return {
    ...deliverable,
    selectedVersion: versionKey,
    storyboardVersions: {
      ...(deliverable.storyboardVersions ?? {}),
      [versionKey]: { ...versionMeta, panels },
    },
  };
}

export function buildProDeliverableWithVersionPanels(
  project: StoryboardProject,
  deliverable: ProDeliverable,
  versionKey: FashionVersionKey,
): ProDeliverable {
  const panels = resolveProStoryboardPanelsForVersion(project, versionKey, deliverable);
  const metaDeliverable = isProDeliverable(project.meta?.deliverable)
    ? (project.meta!.deliverable as ProDeliverable)
    : null;
  const versionMeta =
    deliverable.storyboardVersions?.[versionKey] ??
    metaDeliverable?.storyboardVersions?.[versionKey] ?? {
      id: versionKey,
      title: `${versionKey}版`,
      panels: [],
    };
  if (!panels?.length) return deliverable;
  return {
    ...deliverable,
    selectedVersion: versionKey,
    storyboardVersions: {
      ...(deliverable.storyboardVersions ?? {}),
      [versionKey]: { ...versionMeta, panels },
    },
  };
}

export function resolveFashionDeliverable(project: StoryboardProject): FashionDeliverable | null {
  let merged: FashionDeliverable | null = isFashionDeliverable(project.meta?.deliverable)
    ? (project.meta!.deliverable as FashionDeliverable)
    : null;

  for (const msg of project.chatHistory) {
    if (msg?.role !== "assistant") continue;
    const parsed = extractFashionDeliverableFromText(msg.content);
    if (!parsed) continue;
    merged = merged ? mergeFashionDeliverableState(merged, parsed) : parsed;
  }

  if (!merged) return null;

  const wf = getFashionWorkflowMeta(project);
  const metaDeliverable = isFashionDeliverable(project.meta?.deliverable)
    ? (project.meta!.deliverable as FashionDeliverable)
    : null;
  if (metaDeliverable?.sellpoints?.length) {
    const chatSellpoints = merged.sellpoints;
    if (
      metaDeliverable.sellpointsLocked ||
      wf.fashionSellpointsEdited ||
      metaDeliverable.sellpoints.some((sp) => {
        const prev = chatSellpoints.find((d) => d.id === sp.id);
        return sp.text.trim() !== (prev?.text ?? "").trim();
      })
    ) {
      merged = {
        ...merged,
        sellpoints: metaDeliverable.sellpoints,
        sellpointsLocked: metaDeliverable.sellpointsLocked || merged.sellpointsLocked,
      };
    }
  }

  merged = {
    ...merged,
    dimensions: mergeFashionDimensionSources(
      merged.dimensions,
      metaDeliverable?.dimensions,
      buildFashionDimensionsFromChat(project.chatHistory),
    ) as FashionDeliverable["dimensions"],
  };

  merged = applyFashionDeliverablePhaseGuards(merged, project);

  merged = applyFashionMetaAuthorityToDeliverable(merged, project);

  if (
    !merged.storyboardLocked &&
    merged.selectedVersion &&
    isStoryboardConfirmAfterLastVersionPick(project)
  ) {
    merged = { ...merged, storyboardLocked: true };
  }

  return merged;
}

export function resolveProVerticalDeliverable(
  project: StoryboardProject,
): ProDeliverable | FashionDeliverable | null {
  if (isNonFashionProVertical(project)) {
    let merged: ProDeliverable | null = isProDeliverable(project.meta?.deliverable)
      ? (project.meta!.deliverable as ProDeliverable)
      : readMetaProDeliverable(project.meta?.deliverable);

    for (const msg of project.chatHistory) {
      if (msg?.role !== "assistant") continue;
      const parsed = extractProDeliverableFromText(msg.content);
      if (!parsed) continue;
      merged = merged ? mergeProDeliverableState(merged, parsed) : parsed;
    }
    if (!merged) return null;

    const vertical = getProjectVertical(project)!;
    const metaDeliverable = isProDeliverable(project.meta?.deliverable)
      ? (project.meta!.deliverable as ProDeliverable)
      : null;
    merged = {
      ...merged,
      vertical,
      dimensions: mergeProDimensionSources(
        vertical,
        merged.dimensions,
        metaDeliverable?.dimensions,
        buildProDimensionsFromChat(vertical, project.chatHistory),
      ),
    };

    merged = applyProDeliverablePhaseGuards(merged, project);
    merged = applyProMetaAuthorityToDeliverable(merged, project);

    if (
      !merged.storyboardLocked &&
      merged.selectedVersion &&
      isStoryboardConfirmAfterLastVersionPick(project)
    ) {
      merged = { ...merged, storyboardLocked: true };
    }

    return merged;
  }
  return resolveFashionDeliverable(project);
}

/** 工作流阶段判断：服装 + Pro 品类（包包/3C）统一读 deliverable */
function workflowDeliverable(
  project: StoryboardProject,
): FashionDeliverable | ProDeliverable | null {
  return resolveProVerticalDeliverable(project);
}

function countFashionStoryboardVersions(d: FashionDeliverable | null | undefined): number {
  return listFashionStoryboardVersionKeys(d).length;
}

export function listFashionStoryboardVersionKeys(
  d:
    | Pick<FashionDeliverable, "storyboardVersions">
    | Pick<ProDeliverable, "storyboardVersions">
    | null
    | undefined,
): FashionVersionKey[] {
  const versions = d?.storyboardVersions ?? {};
  return (["A", "B", "C", "D", "E"] as FashionVersionKey[]).filter((k) => {
    const v = versions[k];
    if (!v || typeof v !== "object") return false;
    return (
      (v.panels?.length ?? 0) > 0 ||
      Boolean(v.title?.trim()) ||
      Boolean(v.summary?.trim())
    );
  });
}

export function inferFashionPhaseFromState(project: StoryboardProject): FashionPhase {
  if (isProModeProject(project) && !getProjectVertical(project)) {
    if (!hasProProductRef(project)) return "product_ref";
    return "category_pick";
  }
  if (isNonFashionProVertical(project)) {
    const d = resolveProVerticalDeliverable(project) as ProDeliverable | null;
    if (!hasFashionProductRef(project)) return "product_ref";
    const pastDimensions =
      Boolean(d?.sellpointsLocked) ||
      (d?.sellpoints?.length ?? 0) > 0 ||
      (d?.voiceovers?.length ?? 0) > 0 ||
      listProStoryboardVersionKeys(d).length > 0 ||
      Boolean(d?.selectedVersion) ||
      hasMeaningfulProOpsPack(d ?? ({} as ProDeliverable));
    if (!pastDimensions && !dimensionsComplete(project)) return "dimensions";
    if (!d?.sellpoints?.length || !d.sellpointsLocked) return "sellpoints";
    if ((d.voiceovers?.length ?? 0) === 0) return "sellpoints";
    if (!d.selectedVoiceoverId) return "voiceover_pick";
    if (listProStoryboardVersionKeys(d).length === 0) return "voiceover_pick";
    if (!d.selectedVersion) return "storyboard_pick";
    if (!d.storyboardLocked) return "storyboard_confirm";
    if (!hasMeaningfulProOpsPack(d)) return "storyboard_confirm";
    if (!d.outputMode) return "output_mode";
    return "produce";
  }
  const raw = workflowDeliverable(project);
  const d = raw && isFashionDeliverable(raw) ? raw : null;
  if (!hasFashionProductRef(project)) return "product_ref";
  // 已进入卖点之后，禁止因 dimensions 字段被 LLM 冲掉而回退到七维
  const pastDimensions =
    Boolean(d?.sellpointsLocked) ||
    (d?.sellpoints?.length ?? 0) > 0 ||
    (d?.voiceovers?.length ?? 0) > 0 ||
    listFashionStoryboardVersionKeys(d).length > 0 ||
    Boolean(d?.selectedVersion) ||
    hasMeaningfulOpsPack(d);
  if (!pastDimensions && !dimensionsComplete(project)) return "dimensions";
  if (!d?.sellpoints?.length || !d.sellpointsLocked) return "sellpoints";
  if ((d.voiceovers?.length ?? 0) === 0) return "sellpoints";
  if (!d.selectedVoiceoverId) return "voiceover_pick";
  if (listFashionStoryboardVersionKeys(d).length === 0) return "voiceover_pick";
  if (!d.selectedVersion) return "storyboard_pick";
  const storyboardConfirmed = isStoryboardConfirmAfterLastVersionPick(project);
  if (!storyboardConfirmed) return "storyboard_confirm";
  if (!hasMeaningfulOpsPack(d)) return "storyboard_confirm";
  if (!d.outputMode || !hasFashionOutputModeChoiceInChat(project)) return "output_mode";
  return "produce";
}

export function getFashionWorkflowMeta(project: StoryboardProject): FashionWorkflowMeta {
  return (project.meta?.workflow ?? {}) as FashionWorkflowMeta;
}

const FASHION_PHASE_RANK: Record<FashionPhase, number> = {
  product_ref: 0,
  category_pick: 1,
  dimensions: 2,
  sellpoints: 3,
  voiceover_pick: 4,
  storyboard_pick: 5,
  storyboard_confirm: 6,
  ops_pack: 7,
  output_mode: 8,
  produce: 9,
  done: 10,
};

export function getFashionPhase(project: StoryboardProject): FashionPhase {
  const inferred = inferFashionPhaseFromState(project);
  const wf = getFashionWorkflowMeta(project);
  const phaseField = workflowPhaseKey(project);
  const storedPhase = (phaseField === "proPhase" ? wf.proPhase : wf.fashionPhase) as
    | FashionPhase
    | undefined;
  if (!storedPhase || storedPhase === "product_ref") return inferred;

  const inferredRank = FASHION_PHASE_RANK[inferred] ?? 0;
  const wfRank = FASHION_PHASE_RANK[storedPhase] ?? 0;

  // workflow 记录比实际状态超前（LLM 脏 JSON）时，以 inferred 回退
  if (wfRank > inferredRank) return inferred;

  if (inferredRank >= wfRank) return inferred;
  return storedPhase;
}

export function isAwaitingFashionProductRef(project: StoryboardProject): boolean {
  return !hasFashionProductRef(project);
}

function hasFashionProductRef(project: StoryboardProject): boolean {
  return project.references.some((r) => r.role === "product");
}

function dimensionsComplete(project: StoryboardProject): boolean {
  const d = resolveProVerticalDeliverable(project)?.dimensions ?? {};
  return dimensionStepsForProject(project).every((s) => Boolean(d[s.key]?.trim()));
}

export function fashionNeedsProductRefAutoAdvance(project: StoryboardProject): boolean {
  const product = project.references.find((r) => r.role === "product");
  if (!product) return false;
  const wf = getFashionWorkflowMeta(project);
  const phase = wf.proPhase ?? wf.fashionPhase;
  if (isAwaitingProCategoryPick(project)) {
    return phase === "product_ref" || phase == null || phase === "category_pick";
  }
  if (isNonFashionProVertical(project)) {
    return wf.proPhase === "product_ref" || wf.proPhase == null;
  }
  return wf.fashionPhase === "product_ref" || wf.fashionPhase == null;
}

function buildProProductRefCategoryPickAdvance(
  project: StoryboardProject,
  opts?: { includeChat?: boolean },
): {
  chatHistory?: StoryboardChatMessage[];
  workflow: Record<string, unknown>;
} {
  const wf = getFashionWorkflowMeta(project);
  const phaseKey = workflowPhaseKey(project);
  const workflow = {
    ...wf,
    proMode: true,
    [phaseKey]: "category_pick" as const,
    initialProductRefAcknowledged: true,
  };
  if (opts?.includeChat === false) {
    return { workflow };
  }
  const base = project.chatHistory.filter(
    (m) => m.id !== "welcome" && !m.id.startsWith("err-"),
  );
  const hasUserAck = base.some(
    (m) => m.role === "user" && m.content.trim() === FASHION_PRODUCT_REF_ACK,
  );
  const hasAssistantHint = base.some(
    (m) => m.role === "assistant" && m.content.includes("选择大类品类"),
  );
  const next: StoryboardChatMessage[] = [...base];
  if (!hasUserAck) {
    next.push({
      id: `user-auto-ref-${Date.now()}`,
      role: "user",
      content: FASHION_PRODUCT_REF_ACK,
      createdAt: new Date().toISOString(),
    });
  }
  if (!hasAssistantHint) {
    next.push({
      id: `assistant-cat-pick-${Date.now()}`,
      role: "assistant",
      content: PRO_CATEGORY_PICK_HINT,
      createdAt: new Date().toISOString(),
    });
  }
  return { chatHistory: next, workflow };
}

export function buildFashionProductRefAutoAdvance(
  project: StoryboardProject,
  opts?: { includeChat?: boolean },
): {
  chatHistory?: StoryboardChatMessage[];
  workflow: Record<string, unknown>;
} {
  if (isAwaitingProCategoryPick(project)) {
    return buildProProductRefCategoryPickAdvance(project, opts);
  }
  const wf = getFashionWorkflowMeta(project);
  const vertical = getProjectVertical(project) ?? "fashion_apparel";
  const config = getProVerticalConfig(vertical);
  const workflow = {
    ...wf,
    vertical,
    [workflowPhaseKey(project)]: "dimensions" as const,
    dimensionStep: 0,
    initialProductRefAcknowledged: true,
  };
  if (opts?.includeChat === false) {
    return { workflow };
  }
  const base = project.chatHistory.filter(
    (m) => m.id !== "welcome" && !m.id.startsWith("err-"),
  );
  const hasUserAck = base.some(
    (m) => m.role === "user" && m.content.trim() === FASHION_PRODUCT_REF_ACK,
  );
  const hasAssistantHint = base.some(
    (m) =>
      m.role === "assistant" &&
      m.content.includes("已检测到产品图"),
  );
  const next: StoryboardChatMessage[] = [...base];
  if (!hasUserAck) {
    next.push({
      id: `user-auto-ref-${Date.now()}`,
      role: "user",
      content: FASHION_PRODUCT_REF_ACK,
      createdAt: new Date().toISOString(),
    });
  }
  if (!hasAssistantHint) {
    next.push({
      id: `assistant-auto-ref-${Date.now()}`,
      role: "assistant",
      content: config?.productRefAdvanceHint ?? "已检测到产品图，请开始七维参数采集。",
      createdAt: new Date().toISOString(),
    });
  }
  return { chatHistory: next, workflow };
}

export function isFashionDimensionCollecting(project: StoryboardProject): boolean {
  if (isAwaitingProCategoryPick(project) || getFashionPhase(project) === "category_pick") {
    return false;
  }
  if (!getProjectVertical(project)) return false;
  if (!hasFashionProductRef(project)) return false;
  return getFashionPhase(project) === "dimensions" && !dimensionsComplete(project);
}

export function isAwaitingFashionCustomDimensionInput(project: StoryboardProject): boolean {
  return Boolean(getFashionWorkflowMeta(project).awaitingFashionCustomDimension);
}

function buildFashionDimensionStepPatch(
  project: StoryboardProject,
  dimStep: number,
  value: string,
  extraWorkflow: Record<string, unknown> = {},
): Record<string, unknown> | null {
  const steps = dimensionStepsForProject(project);
  if (dimStep >= steps.length) return null;
  const step = steps[dimStep]!;
  const wf = getFashionWorkflowMeta(project);
  const vertical = getProjectVertical(project) ?? "fashion_apparel";
  const config = getProVerticalConfig(vertical);
  const metaDeliverable = isFashionDeliverable(project.meta?.deliverable)
    ? (project.meta!.deliverable as FashionDeliverable)
    : isProDeliverable(project.meta?.deliverable)
      ? (project.meta!.deliverable as ProDeliverable)
      : null;
  const trimmed = value.trim();
  if (trimmed.length < 2) return null;

  const useProDimensions = getProVerticalConfig(vertical)?.schemaVersion === "pro-v1";
  const nextDimensions = useProDimensions
    ? mergeProDimensionSources(
        vertical,
        metaDeliverable?.dimensions,
        buildProDimensionsFromChat(vertical, project.chatHistory),
        { [step.key]: trimmed },
      )
    : mergeFashionDimensionSources(
          metaDeliverable?.dimensions as FashionDeliverable["dimensions"],
          buildFashionDimensionsFromChat(project.chatHistory),
          { [step.key]: trimmed },
        );
  const deliverable = resolveProVerticalDeliverable(project);
  const nextStep = dimStep + 1;
  const done = nextStep >= steps.length;
  const schema = deliverableSchemaForProject(project);
  return {
    deliverable: {
      schemaVersion: schema,
      vertical,
      productName: wf.productName ?? project.title ?? config?.projectTitle ?? "商品",
      dimensions: nextDimensions,
      sellpoints: deliverable?.sellpoints ?? [],
      sellpointsLocked: false,
      voiceovers: deliverable?.voiceovers ?? [],
      selectedVoiceoverId: deliverable?.selectedVoiceoverId ?? null,
      storyboardVersions: deliverable?.storyboardVersions ?? {},
      selectedVersion: deliverable?.selectedVersion ?? null,
      coverageChecklist: deliverable?.coverageChecklist ?? [],
      outputMode: deliverable?.outputMode ?? null,
    },
    workflow: {
      ...wf,
      vertical,
      [workflowPhaseKey(project)]: done ? "sellpoints" : "dimensions",
      dimensionStep: done ? steps.length : nextStep,
      awaitingFashionCustomDimension: false,
      ...extraWorkflow,
    },
  };
}

export function currentFashionDimensionStep(project: StoryboardProject): number {
  const wf = getFashionWorkflowMeta(project);
  if (typeof wf.dimensionStep === "number") return wf.dimensionStep;
  const d = workflowDeliverable(project)?.dimensions ?? {};
  for (let i = 0; i < FASHION_DIMENSION_STEPS.length; i++) {
    const key = FASHION_DIMENSION_STEPS[i]!.key;
    if (!d[key]?.trim()) return i;
  }
  return FASHION_DIMENSION_STEPS.length;
}

export function nextFashionSellpointId(existing: FashionSellpoint[]): string {
  const nums = existing
    .map((sp) => parseInt(sp.id.replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : existing.length + 1;
  return `S${String(next).padStart(2, "0")}`;
}

export function normalizeFashionSellpointsForSave(
  sellpoints: FashionSellpoint[],
): FashionSellpoint[] {
  return sellpoints
    .map((sp) => ({
      ...sp,
      text: sp.text.trim(),
    }))
    .filter((sp) => sp.text.length >= 1);
}

export function buildFashionSellpointsSavePatch(
  project: StoryboardProject,
  sellpoints: FashionSellpoint[],
): { deliverable: FashionDeliverable | ProDeliverable; workflow: Record<string, unknown> } | null {
  const current = workflowDeliverable(project);
  if (!current || current.sellpointsLocked) return null;
  const normalized = normalizeFashionSellpointsForSave(sellpoints);
  if (!normalized.length) return null;

  const wf = getFashionWorkflowMeta(project);
  return {
    deliverable: { ...current, sellpoints: normalized },
    workflow: {
      ...wf,
      ...phaseWorkflowPatch(project, "sellpoints"),
      ...(usesProPhase(project)
        ? { proSellpointsEdited: true }
        : { fashionSellpointsEdited: true }),
    },
  };
}

export function isFashionStoryboardPanelsEditable(project: StoryboardProject): boolean {
  const d = workflowDeliverable(project);
  return Boolean(
    d?.selectedVersion &&
      !d.storyboardLocked &&
      !hasMeaningfulDeliverableOpsPack(d) &&
      !d.outputMode &&
      isAwaitingFashionStoryboardConfirm(project),
  );
}

export function buildFashionStoryboardPanelsSavePatch(
  project: StoryboardProject,
  panels: FashionPanelRow[],
): { deliverable: FashionDeliverable; workflow: Record<string, unknown> } | null {
  const resolved = workflowDeliverable(project);
  const metaDeliverable = isFashionDeliverable(project.meta?.deliverable)
    ? (project.meta!.deliverable as FashionDeliverable)
    : null;
  const raw = resolved ?? metaDeliverable;
  if (!raw || !isFashionDeliverable(raw)) return null;
  const current = raw;
  const versionKey = current?.selectedVersion ?? metaDeliverable?.selectedVersion;
  if (!current || !versionKey || current.storyboardLocked || hasMeaningfulOpsPack(current) || current.outputMode) {
    return null;
  }
  const version =
    current.storyboardVersions?.[versionKey] ??
    metaDeliverable?.storyboardVersions?.[versionKey];
  if (!version) return null;
  if (!panels.length) return null;

  const wf = getFashionWorkflowMeta(project);
  const nextDeliverable: FashionDeliverable = {
    ...current,
    selectedVersion: versionKey,
    storyboardVersions: {
      ...(current.storyboardVersions ?? {}),
      ...(metaDeliverable?.storyboardVersions ?? {}),
      [versionKey]: {
        ...version,
        panels,
      },
    },
  };
  return {
    deliverable: nextDeliverable,
    workflow: {
      ...wf,
      vertical: "fashion_apparel",
      fashionPhase: "storyboard_confirm",
      fashionStoryboardPanelsEdited: true,
    },
  };
}

export function isAwaitingFashionSellpoints(project: StoryboardProject): boolean {
  const d = workflowDeliverable(project);
  return (
    dimensionsComplete(project) &&
    !d?.sellpointsLocked &&
    getFashionPhase(project) === "sellpoints"
  );
}

export function isAwaitingFashionVoiceoverGeneration(project: StoryboardProject): boolean {
  const d = workflowDeliverable(project);
  return Boolean(
    d?.sellpointsLocked &&
      (d.voiceovers?.length ?? 0) === 0 &&
      !d.selectedVoiceoverId,
  );
}

export function isAwaitingFashionVoiceoverPick(project: StoryboardProject): boolean {
  const d = workflowDeliverable(project);
  return Boolean(
    d?.sellpointsLocked &&
      (d.voiceovers?.length ?? 0) >= 1 &&
      !d.selectedVoiceoverId &&
      listFashionStoryboardVersionKeys(d).length === 0,
  );
}

export function hasFashionStoryboardConfirmInChat(
  project: Pick<StoryboardProject, "chatHistory">,
): boolean {
  return project.chatHistory.some(
    (m) => m.role === "user" && isFashionStoryboardConfirmUserMessage(m.content),
  );
}

/** 用户是否在助手区明确点选过路径 A / 路径 B（与「选择分镜 A版」无关） */
export function hasFashionOutputModeChoiceInChat(
  project: Pick<StoryboardProject, "chatHistory">,
): boolean {
  return project.chatHistory.some(
    (m) =>
      m.role === "user" &&
      (m.content.trim() === FASHION_OUTPUT_SCRIPT ||
        m.content.trim() === FASHION_OUTPUT_VIDEO),
  );
}

function isStoryboardConfirmAfterLastVersionPick(project: StoryboardProject): boolean {
  let lastVersionIdx = -1;
  let lastConfirmIdx = -1;
  for (let i = 0; i < project.chatHistory.length; i++) {
    const msg = project.chatHistory[i];
    if (msg?.role !== "user") continue;
    const trimmed = msg.content.trim();
    if (/^选择分镜\s*[A-E]版/.test(trimmed)) lastVersionIdx = i;
    if (
      isFashionStoryboardConfirmUserMessage(trimmed) ||
      trimmed === FASHION_REGENERATE_OPS
    ) {
      lastConfirmIdx = i;
    }
  }
  return lastConfirmIdx >= 0 && lastConfirmIdx > lastVersionIdx;
}

export function isFashionPendingOpsGeneration(project: StoryboardProject): boolean {
  const d = workflowDeliverable(project);
  if (!d?.selectedVersion || d.outputMode || hasMeaningfulDeliverableOpsPack(d)) return false;
  if (getFashionPhase(project) !== "storyboard_confirm") return false;
  return Boolean(d.storyboardLocked || isStoryboardConfirmAfterLastVersionPick(project));
}

export function isAwaitingFashionStoryboardConfirm(project: StoryboardProject): boolean {
  const d = workflowDeliverable(project);
  if (!d?.selectedVersion || d.outputMode || d.storyboardLocked) return false;
  if (isStoryboardConfirmAfterLastVersionPick(project)) return false;
  return getFashionPhase(project) === "storyboard_confirm";
}

export function isAwaitingFashionStoryboardPick(project: StoryboardProject): boolean {
  const d = workflowDeliverable(project);
  if (!d || d.selectedVersion || d.outputMode || d.storyboardLocked) return false;
  if (listFashionStoryboardVersionKeys(d).length === 0) return false;
  return getFashionPhase(project) === "storyboard_pick";
}

export function buildFashionStoryboardPickChoices(project: StoryboardProject): FashionChoice[] {
  const d = workflowDeliverable(project);
  const versions = d?.storyboardVersions ?? {};
  const keys = listFashionStoryboardVersionKeys(d);
  const choices = keys.map((k) => {
    const v = versions[k]!;
    return {
      id: `version-${k}`,
      title: `${k}版：${v.title || "分镜方案"}`,
      description: v.summary,
      message: fashionVersionChoiceLabel(k, v.title),
      recommended: k === "A",
    };
  });
  if (keys.length < 5) {
    choices.push({
      id: "regen-storyboards",
      title: FASHION_REGENERATE_STORYBOARDS,
      description: "补全或重新生成 A–E 五套分镜",
      message: FASHION_REGENERATE_STORYBOARDS,
      recommended: false,
    });
  }
  return choices;
}

export function isAwaitingFashionOpsConfirm(project: StoryboardProject): boolean {
  const d = workflowDeliverable(project);
  return Boolean(
    d?.selectedVersion &&
      hasMeaningfulDeliverableOpsPack(d) &&
      getFashionPhase(project) === "ops_pack",
  );
}

export function isFashionInProduce(project: StoryboardProject): boolean {
  const d = workflowDeliverable(project);
  const wf = getFashionWorkflowMeta(project);
  const wfPhase = wf.fashionPhase ?? wf.proPhase;
  const metaOut = isFashionDeliverable(project.meta?.deliverable)
    ? (project.meta!.deliverable as FashionDeliverable).outputMode
    : isProDeliverable(project.meta?.deliverable)
      ? (project.meta!.deliverable as ProDeliverable).outputMode
      : null;
  const outputMode = d?.outputMode ?? metaOut ?? null;
  if (!outputMode) return false;
  if (wfPhase === "produce" || wfPhase === "done") return true;
  return getFashionPhase(project) === "produce" && hasFashionOutputModeChoiceInChat(project);
}

export function isAwaitingFashionOutputMode(project: StoryboardProject): boolean {
  if (isFashionInProduce(project)) return false;
  const d = workflowDeliverable(project);
  return Boolean(
    d?.selectedVersion &&
      d.storyboardLocked &&
      hasMeaningfulDeliverableOpsPack(d) &&
      !d.outputMode &&
      getFashionPhase(project) === "output_mode",
  );
}

export function fashionVoiceoverChoiceLabel(v: { id: string; type: string }): string {
  return `选择口播 ${v.id}：${v.type}`;
}

export function fashionVersionChoiceLabel(
  key: FashionVersionKey,
  title?: string,
): string {
  return `选择分镜 ${key}版${title ? `：${title}` : ""}`;
}

export function parseFashionVoiceoverPick(
  project: StoryboardProject,
  message: string,
): string | null {
  const d = workflowDeliverable(project);
  const trimmed = message.trim();
  if (!trimmed.startsWith("选择口播")) return null;

  if (d?.voiceovers.length) {
    for (const v of d.voiceovers) {
      if (trimmed === fashionVoiceoverChoiceLabel(v)) return v.id;
      if (trimmed.startsWith(`选择口播 ${v.id}`)) return v.id;
    }
  }

  const matched = trimmed.match(/^选择口播\s*(V\d+)/);
  const id = matched?.[1] ?? null;
  if (!id) return null;
  return d?.voiceovers.some((v) => v.id === id) ? id : null;
}

export function parseFashionVersionKeyFromUserMessage(
  message: string,
): FashionVersionKey | null {
  const trimmed = message.trim();
  if (trimmed === FASHION_CONFIRM_STORYBOARD) return null;
  const m = trimmed.match(/^选择分镜\s*([A-E])版/);
  return m?.[1] ? (m[1] as FashionVersionKey) : null;
}

export function isFashionStoryboardConfirmUserMessage(message: string): boolean {
  return message.trim() === FASHION_CONFIRM_STORYBOARD;
}

export function parseFashionVersionPick(
  project: StoryboardProject,
  message: string,
): FashionVersionKey | null {
  const d = workflowDeliverable(project);
  const trimmed = message.trim();
  if (!trimmed.startsWith("选择分镜")) return null;

  if (d?.storyboardVersions) {
    for (const key of ["A", "B", "C", "D", "E"] as FashionVersionKey[]) {
      const version = d.storyboardVersions[key];
      if (!version) continue;
      if (trimmed === fashionVersionChoiceLabel(key, version.title)) return key;
      if (trimmed.startsWith(`选择分镜 ${key}版`)) return key;
    }
  }

  const matched = trimmed.match(/^选择分镜\s*([A-E])版/);
  if (matched?.[1] && ["A", "B", "C", "D", "E"].includes(matched[1])) {
    return matched[1] as FashionVersionKey;
  }
  return null;
}

export function isFashionPendingStoryboardGeneration(
  project: StoryboardProject,
): boolean {
  const d = workflowDeliverable(project);
  return Boolean(
    d?.sellpointsLocked &&
      (d.voiceovers?.length ?? 0) > 0 &&
      d.selectedVoiceoverId &&
      d.voiceovers.some((v) => v.id === d.selectedVoiceoverId) &&
      !d.selectedVersion &&
      listFashionStoryboardVersionKeys(d).length === 0,
  );
}

function inferFashionProduceVideoChoices(project: StoryboardProject): FashionChoice[] {
  if (!isFashionInProduce(project)) return [];
  const d = workflowDeliverable(project);
  if (d?.outputMode !== "direct_video") return [];
  if (!hasSheetImagesReady(project)) return [];
  return [
    {
      id: "fashion-gen-full-video",
      title: STORYBOARD_GENERATE_FULL_VIDEO_CHOICE,
      description: "在模型选择弹层中确认视频模型与成片时长（超过 15s 请选万相 3.0）",
      message: STORYBOARD_GENERATE_FULL_VIDEO_CHOICE,
      recommended: true,
    },
  ];
}

export function inferFashionChoices(project: StoryboardProject): FashionChoice[] {
  if (isLegacyStoryboardProject(project)) return [];

  const produceVideoChoices = inferFashionProduceVideoChoices(project);
  if (produceVideoChoices.length > 0) return produceVideoChoices;

  if (isFashionInProduce(project)) return [];

  if (isAwaitingFashionProductRef(project)) {
    return [];
  }

  if (isAwaitingProCategoryPick(project) || getFashionPhase(project) === "category_pick") {
    return PRO_CATEGORY_OPTIONS.map((cat) => ({
      id: `pro-cat-${cat.id}`,
      title: cat.label,
      description: cat.description,
      message: proCategoryChoiceLabel(cat.label),
      recommended: cat.id === "fashion",
    }));
  }

  const dimStep = currentFashionDimensionStep(project);
  const dimSteps = dimensionStepsForProject(project);
  if (isFashionDimensionCollecting(project) && dimStep < dimSteps.length) {
    if (isAwaitingFashionCustomDimensionInput(project)) return [];
    const step = dimSteps[dimStep]!;
    if (step.ui === "searchSelect") return [];
    if (step.options) {
      return [
        ...step.options.map((opt) => ({
          id: `dim-${step.key}-${opt}`,
          title: opt,
          message: opt,
        })),
        {
          id: `dim-${step.key}-custom`,
          title: FASHION_CUSTOM_DIMENSION_CHOICE,
          description: "不在列表中时，在下方输入框填写后发送",
          message: FASHION_CUSTOM_DIMENSION_CHOICE,
        },
      ];
    }
  }

  if (isAwaitingFashionVoiceoverGeneration(project)) {
    return [
      {
        id: "regen-voiceovers",
        title: FASHION_REGENERATE_VOICEOVERS,
        description: "上次口播生成未完成或失败，点此重新生成 6 套口播文案",
        message: FASHION_REGENERATE_VOICEOVERS,
        recommended: true,
      },
    ];
  }

  if (isAwaitingFashionSellpoints(project)) {
    const d = workflowDeliverable(project);
    if (!d?.sellpoints?.length) return [];
    return [
      {
        id: "lock-sellpoints",
        title: FASHION_LOCK_SELLPOINTS,
        message: FASHION_LOCK_SELLPOINTS,
        recommended: true,
      },
      {
        id: "regen-sellpoints",
        title: FASHION_REGENERATE_SELLPOINTS,
        message: FASHION_REGENERATE_SELLPOINTS,
      },
    ];
  }

  if (isAwaitingFashionVoiceoverPick(project)) {
    return (workflowDeliverable(project)?.voiceovers ?? []).map((v) => ({
      id: v.id,
      title: v.type,
      description: v.narrative,
      message: fashionVoiceoverChoiceLabel(v),
      recommended: v.id === "V01",
    }));
  }

  if (isAwaitingFashionStoryboardPick(project)) {
    return buildFashionStoryboardPickChoices(project);
  }

  if (isFashionPendingOpsGeneration(project)) {
    return [
      {
        id: "retry-ops",
        title: FASHION_REGENERATE_OPS,
        description: "上次运营包生成未完成或失败，点此重新生成标题、标签与详情文案",
        message: FASHION_REGENERATE_OPS,
        recommended: true,
      },
    ];
  }

  if (isAwaitingFashionStoryboardConfirm(project)) {
    const d = workflowDeliverable(project);
    const key = d?.selectedVersion;
    const title = key ? d?.storyboardVersions?.[key]?.title : undefined;
    return [
      {
        id: "confirm-storyboard",
        title: FASHION_CONFIRM_STORYBOARD,
        description: key
          ? `定稿 ${key}版${title ? `：${title}` : ""}；左侧分镜表可先编辑保存`
          : "确认左侧分镜脚本后继续",
        message: FASHION_CONFIRM_STORYBOARD,
        recommended: true,
      },
      {
        id: "repick-storyboard",
        title: FASHION_REPICK_STORYBOARD,
        description: "返回 A–E 方案列表重新选择",
        message: FASHION_REPICK_STORYBOARD,
      },
    ];
  }

  const dPendingStoryboards = workflowDeliverable(project);
  if (isFashionPendingStoryboardGeneration(project)) {
    return [
      {
        id: "gen-storyboards",
        title: FASHION_GENERATE_STORYBOARDS_LABEL,
        description: "基于已选口播，生成 A–E 五套分镜脚本",
        message: FASHION_REGENERATE_STORYBOARDS,
        recommended: true,
      },
    ];
  }

  if (
    dPendingStoryboards?.sellpointsLocked &&
    !dPendingStoryboards.selectedVersion &&
    listFashionStoryboardVersionKeys(dPendingStoryboards).length === 0 &&
    dPendingStoryboards.voiceovers.length > 0 &&
    !dPendingStoryboards.selectedVoiceoverId
  ) {
    return [];
  }

  if (isAwaitingFashionOutputMode(project)) {
    return [
      {
        id: "output-script",
        title: FASHION_OUTPUT_SCRIPT,
        description: "导出分镜表 + 分镜图，自行剪辑成片",
        message: FASHION_OUTPUT_SCRIPT,
        recommended: true,
      },
      {
        id: "output-video",
        title: FASHION_OUTPUT_VIDEO,
        description: "批量生图后合成整图/分镜视频",
        message: FASHION_OUTPUT_VIDEO,
      },
    ];
  }

  return [];
}

export function fashionLlmFailureAssistantMessage(
  trigger: string,
  cause?: unknown,
): string {
  const causeMsg = cause instanceof Error ? cause.message.trim() : "";
  if (causeMsg && !/fetch|network|Failed to fetch|ECONNREF|timeout/i.test(causeMsg)) {
    if (trigger.includes("sellpoints")) {
      return `卖点生成未完成：${causeMsg}。请点「AI 自动生成卖点」或「重新生成卖点」重试。`;
    }
    if (trigger.includes("voiceovers")) {
      return `口播文案生成未完成：${causeMsg}。请点击「重新生成口播文案」重试。`;
    }
    if (trigger.includes("storyboards")) {
      return `分镜脚本生成未完成：${causeMsg}。请点击「生成 A–E 分镜方案」重试。`;
    }
    if (trigger.includes("ops")) {
      return `运营包生成未完成：${causeMsg}。请重新点击「确认分镜，生成运营包」。`;
    }
    return `${causeMsg}。请重试上一步操作。`;
  }
  if (trigger.includes("voiceovers")) {
    return "口播文案生成失败（网络或服务中断）。卖点已定稿，请点击下方「重新生成口播文案」重试。";
  }
  if (trigger.includes("storyboards")) {
    return "分镜脚本生成失败（网络或服务中断）。口播已选定，请点击下方「生成 A–E 分镜方案」重试。";
  }
  if (trigger.includes("sellpoints")) {
    return "卖点生成失败（网络或服务中断），请点「AI 自动生成卖点」或「重新生成卖点」重试。";
  }
  if (trigger.includes("ops")) {
    return "运营包生成失败（网络或服务中断），请重新点击「确认分镜，生成运营包」。";
  }
  return "生成失败（网络或服务中断），请重试上一步操作。";
}

/** LLM 流失败时回滚 meta：禁止阶段/交付字段超前于实际生成结果 */
export function fashionMetaAfterLlmFailure(
  trigger: string,
  preMeta: {
    deliverable?: StoryboardProject["meta"] extends infer M
      ? M extends { deliverable?: infer D }
        ? D
        : unknown
      : unknown;
    workflow?: Record<string, unknown>;
  },
  metaPatch: { deliverable?: unknown; workflow?: Record<string, unknown> },
): { deliverable?: unknown; workflow: Record<string, unknown> } {
  const prevWf = { ...(preMeta.workflow ?? {}) };
  const prevDeliverable = preMeta.deliverable;

  if (trigger.includes("voiceovers")) {
    return {
      deliverable: metaPatch.deliverable ?? prevDeliverable,
      workflow: {
        ...prevWf,
        ...(metaPatch.workflow ?? {}),
        fashionPhase: "sellpoints",
      },
    };
  }
  if (trigger.includes("sellpoints")) {
    return {
      deliverable: prevDeliverable,
      workflow: { ...prevWf, fashionPhase: "sellpoints" },
    };
  }
  if (trigger.includes("storyboards")) {
    const prevFashion = isFashionDeliverable(prevDeliverable)
      ? (prevDeliverable as FashionDeliverable)
      : null;
    const hadVersions =
      prevFashion?.storyboardVersions &&
      Object.keys(prevFashion.storyboardVersions).length > 0;
    return {
      deliverable: prevDeliverable,
      workflow: {
        ...prevWf,
        fashionPhase: hadVersions ? "storyboard_pick" : "voiceover_pick",
      },
    };
  }
  if (trigger.includes("ops")) {
    const patched = isFashionDeliverable(metaPatch.deliverable)
      ? (metaPatch.deliverable as FashionDeliverable)
      : null;
    const prev = isFashionDeliverable(prevDeliverable)
      ? (prevDeliverable as FashionDeliverable)
      : null;
    const base = patched ?? prev;
    return {
      deliverable: base
        ? {
            ...base,
            opsPack: undefined,
            storyboardLocked: true,
          }
        : prevDeliverable,
      workflow: { ...prevWf, fashionPhase: "storyboard_confirm" },
    };
  }
  return { deliverable: prevDeliverable, workflow: prevWf };
}

export const FASHION_REVISE_DIMENSION_PREFIX = "修改七维·";

export function fashionReviseDimensionChoiceLabel(stepIndex: number): string {
  const step = FASHION_DIMENSION_STEPS[stepIndex];
  return `${FASHION_REVISE_DIMENSION_PREFIX}${step?.label ?? "参数"}`;
}

export function parseFashionReviseDimensionStep(message: string): number | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith(FASHION_REVISE_DIMENSION_PREFIX)) return null;
  const label = trimmed.slice(FASHION_REVISE_DIMENSION_PREFIX.length);
  const idx = FASHION_DIMENSION_STEPS.findIndex((s) => s.label === label);
  return idx >= 0 ? idx : null;
}

export function isFashionDimensionRevisionAllowed(project: StoryboardProject): boolean {
  const d = workflowDeliverable(project);
  if (d?.sellpointsLocked) return false;
  const phase = getFashionPhase(project);
  return phase === "dimensions" || phase === "sellpoints";
}

export function buildFashionReviseDimensionPatch(
  project: StoryboardProject,
  stepIndex: number,
): Record<string, unknown> | null {
  if (stepIndex < 0 || stepIndex >= FASHION_DIMENSION_STEPS.length) return null;
  if (!isFashionDimensionRevisionAllowed(project)) return null;

  const wf = getFashionWorkflowMeta(project);
  const metaDeliverable = isFashionDeliverable(project.meta?.deliverable)
    ? (project.meta!.deliverable as FashionDeliverable)
    : null;
  const currentDims = mergeFashionDimensionSources(
    metaDeliverable?.dimensions,
    buildFashionDimensionsFromChat(project.chatHistory),
  );
  const nextDimensions = { ...currentDims };
  for (let i = stepIndex; i < FASHION_DIMENSION_STEPS.length; i++) {
    delete nextDimensions[FASHION_DIMENSION_STEPS[i]!.key];
  }

  return {
    deliverable: {
      schemaVersion: "fashion-v4",
      vertical: "fashion_apparel",
      productName: wf.productName ?? project.title ?? "服装商品",
      dimensions: nextDimensions,
      sellpoints: [],
      sellpointsLocked: false,
      voiceovers: [],
      selectedVoiceoverId: null,
      storyboardVersions: {},
      selectedVersion: null,
      storyboardLocked: false,
      coverageChecklist: [],
      outputMode: null,
    },
    workflow: {
      ...wf,
      vertical: "fashion_apparel",
      fashionPhase: "dimensions",
      dimensionStep: stepIndex,
      awaitingFashionCustomDimension: false,
      fashionSellpointsEdited: false,
      fashionStoryboardPanelsEdited: false,
    },
  };
}

export function fashionWorkflowPatchForChoice(
  project: StoryboardProject,
  message: string,
): Record<string, unknown> | null {
  const wf = getFashionWorkflowMeta(project);
  const deliverable = resolveProVerticalDeliverable(project);
  const vertical = getProjectVertical(project) ?? "fashion_apparel";

  const categoryPick = parseProCategoryPick(message);
  if (categoryPick) {
    if (!categoryPick.available || !categoryPick.verticalId) return null;
    const pickedVertical = categoryPick.verticalId;
    const config = getProVerticalConfig(pickedVertical);
    const phaseKey = pickedVertical === "fashion_apparel" ? "fashionPhase" : "proPhase";
    const otherPhaseKey = pickedVertical === "fashion_apparel" ? "proPhase" : "fashionPhase";
    return {
      workflow: {
        ...wf,
        proMode: true,
        vertical: pickedVertical,
        [phaseKey]: "dimensions",
        [otherPhaseKey]: undefined,
        dimensionStep: 0,
        initialProductRefAcknowledged: true,
      },
      projectTitle: config?.projectTitle,
      assistantReply: config
        ? `已切换至【${config.label}】。${config.productRefAdvanceHint}`
        : undefined,
    };
  }

  if (message === FASHION_PRODUCT_REF_ACK) {
    if (!hasFashionProductRef(project)) return null;
    return buildFashionProductRefAutoAdvance(project, { includeChat: false });
  }

  const reviseStep = parseFashionReviseDimensionStep(message);
  if (reviseStep != null) {
    return buildFashionReviseDimensionPatch(project, reviseStep);
  }

  const dimStep = currentFashionDimensionStep(project);
  const steps = dimensionStepsForProject(project);
  if (isFashionDimensionCollecting(project) && dimStep < steps.length) {
    const step = steps[dimStep]!;

    if (message === FASHION_CUSTOM_DIMENSION_CHOICE && step.options) {
      return {
        workflow: {
          ...wf,
          vertical,
          awaitingFashionCustomDimension: true,
        },
      };
    }

    if (wf.awaitingFashionCustomDimension && message !== FASHION_CUSTOM_DIMENSION_CHOICE) {
      return buildFashionDimensionStepPatch(project, dimStep, message);
    }

    const metaDims = (deliverable?.dimensions as Partial<Record<string, string>> | undefined) ?? {};
    const resolvedOptions = resolveDimensionStepOptions(vertical, step, {
      ...metaDims,
      ...buildProDimensionsFromChat(vertical, project.chatHistory),
    });
    const isOption =
      step.options?.includes(message as never) ||
      (step.ui === "searchSelect" && resolvedOptions.includes(message));
    const isFreeText = step.freeText && message.trim().length >= 2;
    if (isOption || isFreeText) {
      return buildFashionDimensionStepPatch(project, dimStep, message);
    }
  }

  if (message === FASHION_AI_SELLPOINTS_CHOICE || message === FASHION_REGENERATE_SELLPOINTS) {
    return {
      llmTrigger: llmTriggerFor(project, "sellpoints"),
      workflow: {
        ...wf,
        ...(usesProPhase(project) ? { proSellpointsEdited: false } : { fashionSellpointsEdited: false }),
      },
    };
  }

  if (message === FASHION_REGENERATE_STORYBOARDS && deliverable?.sellpointsLocked) {
    const voiceoverId =
      deliverable.selectedVoiceoverId ??
      parseFashionVoiceoverPickFromChat(project.chatHistory);
    if (!voiceoverId) return null;
    const versionKeys = usesProPhase(project)
      ? listProStoryboardVersionKeys(deliverable as ProDeliverable)
      : listFashionStoryboardVersionKeys(deliverable as FashionDeliverable);
    return {
      deliverable: {
        ...deliverable,
        selectedVoiceoverId: voiceoverId,
        selectedVersion: null,
      },
      workflow: {
        ...wf,
        ...phaseWorkflowPatch(project, versionKeys.length > 0 ? "storyboard_pick" : "voiceover_pick"),
      },
      llmTrigger: llmTriggerFor(project, "storyboards"),
    };
  }

  if (
    (message === FASHION_LOCK_SELLPOINTS || message === FASHION_REGENERATE_VOICEOVERS) &&
    deliverable
  ) {
    const metaRaw = project.meta?.deliverable;
    const metaDeliverable =
      isProDeliverable(metaRaw) || isFashionDeliverable(metaRaw) ? metaRaw : null;
    const sellpointsEdited = Boolean(wf.proSellpointsEdited || wf.fashionSellpointsEdited);
    const sellpoints =
      metaDeliverable?.sellpoints?.length &&
      (sellpointsEdited ||
        metaDeliverable.sellpoints.some((sp) => {
          const prev = deliverable.sellpoints.find((d) => d.id === sp.id);
          return sp.text.trim() !== (prev?.text ?? "").trim();
        }))
        ? metaDeliverable.sellpoints
        : deliverable.sellpoints;
    return {
      deliverable: {
        ...deliverable,
        sellpoints,
        sellpointsLocked: true,
        voiceovers: [],
        selectedVoiceoverId: null,
        storyboardVersions: {},
        selectedVersion: null,
        storyboardLocked: false,
        opsPack: undefined,
        outputMode: null,
      },
      workflow: {
        ...wf,
        ...phaseWorkflowPatch(project, "sellpoints"),
        ...(usesProPhase(project) ? { proSellpointsEdited: false } : { fashionSellpointsEdited: false }),
      },
      llmTrigger: llmTriggerFor(project, "voiceovers"),
    };
  }

  const voiceoverId = parseFashionVoiceoverPick(project, message);
  if (voiceoverId && deliverable?.voiceovers.some((v) => v.id === voiceoverId)) {
    return {
      deliverable: { ...deliverable, selectedVoiceoverId: voiceoverId },
      workflow: { ...wf, ...phaseWorkflowPatch(project, "voiceover_pick") },
      llmTrigger: llmTriggerFor(project, "storyboards"),
    };
  }

  const versionKey = parseFashionVersionPick(project, message);
  if (versionKey && deliverable) {
    return {
      deliverable: {
        ...deliverable,
        selectedVersion: versionKey,
        storyboardLocked: false,
        opsPack: undefined,
        outputMode: null,
      },
      workflow: {
        ...wf,
        ...phaseWorkflowPatch(project, "storyboard_confirm"),
        ...(usesProPhase(project)
          ? { proStoryboardPanelsEdited: false }
          : { fashionStoryboardPanelsEdited: false }),
      },
    };
  }

  if (
    (message === FASHION_CONFIRM_STORYBOARD || message === FASHION_REGENERATE_OPS) &&
    deliverable?.selectedVersion
  ) {
    if (deliverable.storyboardLocked && hasMeaningfulDeliverableOpsPack(deliverable)) {
      return null;
    }
    const phase = getFashionPhase(project);
    if (
      deliverable.storyboardLocked &&
      (phase === "output_mode" || phase === "produce")
    ) {
      return null;
    }
    const key = deliverable.selectedVersion;
    const withPanels = usesProPhase(project)
      ? deliverable
      : buildFashionDeliverableWithVersionPanels(project, deliverable as FashionDeliverable, key);
    return {
      deliverable: {
        ...withPanels,
        selectedVersion: key,
        storyboardLocked: true,
      },
      workflow: {
        ...wf,
        ...phaseWorkflowPatch(project, "storyboard_confirm"),
        ...(usesProPhase(project)
          ? { proStoryboardPanelsEdited: false }
          : { fashionStoryboardPanelsEdited: false }),
      },
      llmTrigger: llmTriggerFor(project, "ops"),
    };
  }

  if (message === FASHION_REPICK_STORYBOARD && deliverable) {
    return {
      deliverable: {
        ...deliverable,
        selectedVersion: null,
        storyboardLocked: false,
        opsPack: undefined,
        outputMode: null,
      },
      workflow: {
        ...wf,
        ...phaseWorkflowPatch(project, "storyboard_pick"),
        ...(usesProPhase(project)
          ? { proStoryboardPanelsEdited: false }
          : { fashionStoryboardPanelsEdited: false }),
      },
    };
  }

  if (message === FASHION_OUTPUT_SCRIPT && deliverable?.selectedVersion) {
    const phase = getFashionPhase(project);
    const wfPhase = wf.fashionPhase ?? wf.proPhase;
    if (
      deliverable.outputMode === "script_compose" &&
      (phase === "produce" ||
        phase === "done" ||
        wfPhase === "produce" ||
        wfPhase === "done")
    ) {
      return null;
    }
    const key = deliverable.selectedVersion;
    const withPanels = usesProPhase(project)
      ? buildProDeliverableWithVersionPanels(project, deliverable as ProDeliverable, key)
      : buildFashionDeliverableWithVersionPanels(project, deliverable as FashionDeliverable, key);
    return {
      deliverable: {
        ...withPanels,
        outputMode: "script_compose",
        storyboardLocked: true,
      },
      workflow: {
        ...wf,
        ...phaseWorkflowPatch(project, "produce"),
        ...(usesProPhase(project)
          ? { proProduceSetupPending: false }
          : { fashionProduceSetupPending: false }),
      },
      syncSheet: true,
    };
  }

  if (message === FASHION_OUTPUT_VIDEO && deliverable?.selectedVersion) {
    const metaDeliverableOut = isFashionDeliverable(project.meta?.deliverable)
      ? (project.meta!.deliverable as FashionDeliverable).outputMode
      : isProDeliverable(project.meta?.deliverable)
        ? (project.meta!.deliverable as ProDeliverable).outputMode
        : null;
    const committedOutputMode = deliverable.outputMode ?? metaDeliverableOut ?? null;
    const wfPhase = wf.fashionPhase ?? wf.proPhase;
    if (committedOutputMode === "direct_video" && (wfPhase === "produce" || wfPhase === "done")) {
      return null;
    }
    const key = deliverable.selectedVersion;
    const withPanels = usesProPhase(project)
      ? buildProDeliverableWithVersionPanels(project, deliverable as ProDeliverable, key)
      : buildFashionDeliverableWithVersionPanels(project, deliverable as FashionDeliverable, key);
    return {
      deliverable: {
        ...withPanels,
        outputMode: "direct_video",
        storyboardLocked: true,
      },
      workflow: {
        ...wf,
        ...phaseWorkflowPatch(project, "produce"),
        ...(usesProPhase(project)
          ? { proProduceSetupPending: true }
          : { fashionProduceSetupPending: true }),
      },
      syncSheet: true,
    };
  }

  return null;
}

export function fashionAssistantPlaceholder(project: StoryboardProject): string {
  if (isLegacyStoryboardProject(project)) return "旧版项目只读，请新建服装专业项目";
  if (isAwaitingFashionProductRef(project)) return "请先在左侧素材区上传或粘贴产品图";
  if (isAwaitingProCategoryPick(project) || getFashionPhase(project) === "category_pick") {
    return "请在下方选择大类品类";
  }
  const dimStep = currentFashionDimensionStep(project);
  if (isFashionDimensionCollecting(project)) {
    if (isAwaitingFashionCustomDimensionInput(project)) {
      const step = FASHION_DIMENSION_STEPS[dimStep];
      return step ? `请输入${step.label}（自定义，2 字以上）` : "请输入自定义内容";
    }
    const step = FASHION_DIMENSION_STEPS[dimStep];
    if (step?.freeText) return fashionDimensionPrompt(dimStep);
    return "请点选上方卡片，或选「自定义」后在下方输入";
  }
  if (isAwaitingFashionSellpoints(project)) {
    return "输入卖点关键词，或点选「AI自动生成卖点」";
  }
  if (isAwaitingFashionVoiceoverGeneration(project)) {
    return "口播文案生成未完成，请点「重新生成口播文案」";
  }
  if (isAwaitingFashionVoiceoverPick(project)) {
    return "请点选一套口播文案继续";
  }
  if (isAwaitingFashionStoryboardPick(project)) {
    const count = listFashionStoryboardVersionKeys(workflowDeliverable(project)).length;
    return count < 5
      ? `请点选 ${count} 套分镜方案继续，或选「重新生成分镜」补全 A–E 版`
      : "请点选 A–E 分镜方案继续";
  }
  if (isAwaitingFashionStoryboardConfirm(project)) {
    return "请查看左侧 12.1 分镜表，确认定稿后点「确认分镜，生成运营包」";
  }
  if (isAwaitingFashionOutputMode(project)) {
    return "请选择成片方式：分镜脚本交付，或故事版一键成片";
  }
  const d = workflowDeliverable(project);
  if (getFashionPhase(project) === "produce" && d?.outputMode) {
    return d.outputMode === "direct_video"
      ? "策划已完成；请在中栏「故事版 · 成片工作区」生图与合成，无需再点右侧选项"
      : "策划已完成；请在中栏「分镜图」区完成出图与导出，无需再点右侧选项";
  }
  return "请点选上方选项继续";
}

export const FASHION_WELCOME = PRO_GENERIC_WELCOME;
export { PRO_GENERIC_WELCOME };
