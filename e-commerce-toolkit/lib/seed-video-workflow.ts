import type { SeedVideoChatMessage, SeedVideoProject, SeedVideoProductionMode, SeedVideoWorkflowPhase, SeedVideoChoiceSnapshot, SeedVideoDirectPlan } from "@/lib/seed-video-types";
import {
  getSeedVideoSkillDefinition,
  listSeedVideoSkillDefinitions,
  resolveSeedVideoSkillKey,
} from "@/lib/seed-video-skills";
import {
  extractSeedVideoStructuredPatch,
  hasStructuredDirectPlan,
  hasStructuredFormalShots,
  resolveDirectPlanFromAssistantText,
  scriptProposalsFromStructuredPatch,
} from "@/lib/seed-video-structured";
import {
  scriptIdFromProposalIndex,
  type ParsedScriptProposal,
} from "@/lib/seed-video-script-parse";

export const SCRIPT_CHOICES = [
  "脚本一：氛围感切入‑不费力的高级",
  "脚本二：痛点切入‑梨形身材天菜",
  "脚本三：场景切入‑度假出片指南",
] as const;

export const MODE_CHOICES = [
  "方案①：直接连贯生成视频",
  "方案②：按精细成片流程制作",
] as const;

export const STYLE_CHOICES = [
  "A方案：甜美种草风（小红书）",
  "B方案：干练安利风（抖音带货）",
] as const;

export type SeedVideoAssistantChoice = {
  id: string;
  label: string;
  message: string;
  title: string;
  description?: string;
  recommended?: boolean;
  kind?: "script" | "mode" | "style" | "generate-all" | "review" | "shots";
};

export const STORYBOARD_REVIEW_CHOICE_MESSAGES = [
  "重新生成：请按当前脚本与风格，重新输出视频分镜执行表",
  "修改分镜时长：请优化各镜时长分配并更新分镜执行表",
  "替换 BGM 建议：请给出新的 BGM 推荐并更新制作说明",
  "确认分镜执行表，进入下一步生成正式脚本",
] as const;

export const EDIT_STORYBOARD_CHOICE_MESSAGE =
  "修改脚本：请在中间工作区编辑分镜执行表";

export const FINAL_SHOTS_REVIEW_CHOICE_MESSAGES = [
  "重新生成：请重新输出逐镜参数表（镜号/时间切片/AI视频生成提示词）",
  "确认逐镜参数表，同步到中间工作区",
] as const;

export const FINAL_SHOTS_CONFIRM_MESSAGE = FINAL_SHOTS_REVIEW_CHOICE_MESSAGES[1]!;

export const DIRECT_PLAN_CONFIRM_MESSAGE = "确认成片参数，同步到中间工作区";
export const DIRECT_PLAN_REGENERATE_MESSAGE =
  "重新生成：请按当前脚本重新输出直接连贯成片参数";

export function hasSeedVideoShotsTableMarkdown(text: string): boolean {
  if (!/\|/.test(text)) return false;
  if (isSeedVideoScriptProposalMarkdown(text)) return false;
  if (/视频分镜执行表|分镜执行表/.test(text) && !/正式脚本|请确认逐镜参数表|运镜参数表/.test(text)) {
    return false;
  }
  if (/正式脚本|请确认逐镜参数表|运镜参数表|逐镜参数表/.test(text)) return true;
  if (!/镜号|序号/.test(text)) return false;
  const hasPromptCol = /AI\s*视频生成提示词|AI提示词参考|AI提示词|Prompt|提示词/.test(text);
  const hasSceneCol =
    /时间切片|时长|参考素材|镜头描述|素材映射|素材|画面描述|运镜方式|运镜/.test(text);
  // Step2 脚本提案常见「镜号+画面描述+口播」但无 AI 视频提示词列 — 不算正式逐镜表
  if (!/正式脚本|请确认逐镜参数表/.test(text) && !hasPromptCol) return false;
  if (hasPromptCol && hasSceneCol) return true;
  if (/口播/.test(text) && hasSceneCol && /运镜|画面描述|镜头描述/.test(text)) return true;
  if (/素材映射/.test(text) && hasPromptCol) return true;
  return false;
}

/** Step2 三套脚本提案（未选脚本前），不得当作正式分镜/逐镜参数表 */
export function isSeedVideoScriptProposalMarkdown(text: string): boolean {
  if (/正式脚本|请确认逐镜参数表|分镜执行表|视频分镜执行表|运镜参数|逐镜参数表/.test(text)) {
    return false;
  }
  if (/请选择.*脚本|请选择脚本|请选择你喜欢的脚本/.test(text)) return true;
  const patch = extractSeedVideoStructuredPatch(text);
  if (patch?.step === "scripts" && patch.scripts?.length === 3) return true;
  if (/```seed-video/.test(text) && /await_script_choice|"step"\s*:\s*"scripts"/.test(text)) {
    return true;
  }
  return false;
}

export function isAssistantPostSyncAck(text: string): boolean {
  if (hasSeedVideoShotsTableMarkdown(text)) return false;
  return /同步成功|已同步到中间|项目最终状态|项目参数配置|脚本流程已结束|请选择后续操作|一键导出提示词|下载项目计划书|结束本次创作/.test(
    text,
  );
}

export function isFinalShotsConfirmChoice(text: string): boolean {
  const t = text.trim();
  return t === FINAL_SHOTS_CONFIRM_MESSAGE || /^确认逐镜参数表/.test(t);
}

export function isFinalShotsRegenerateChoice(text: string): boolean {
  const t = text.trim();
  return (
    t === FINAL_SHOTS_REVIEW_CHOICE_MESSAGES[0] ||
    (/^重新生成/.test(t) && /逐镜|参数表|正式脚本/.test(t))
  );
}

export function isDirectPlanConfirmChoice(text: string): boolean {
  const t = text.trim();
  return t === DIRECT_PLAN_CONFIRM_MESSAGE || /^确认成片参数/.test(t);
}

export function isDirectPlanRegenerateChoice(text: string): boolean {
  const t = text.trim();
  return (
    t === DIRECT_PLAN_REGENERATE_MESSAGE ||
    (/^重新生成/.test(t) && /直接连贯|成片参数|全局.*提示词/.test(t))
  );
}

function isDirectPlanAssistantContent(text: string): boolean {
  return isDirectPlanAssistantMarkdown(text) || hasStructuredDirectPlan(text);
}

function isDirectPlanAssistantMarkdown(text: string): boolean {
  if (/正式脚本|请确认逐镜参数表|分镜执行表|视频分镜执行表/.test(text)) return false;
  if (/AI\s*视频生成提示词|AI提示词参考|AI提示词/.test(text)) return false;
  if (/直接连贯成片参数|请确认成片参数/.test(text)) return true;
  if (/配置项/.test(text) && /参数详情/.test(text) && /口播/.test(text)) return true;
  if (/全局\s*AI\s*生成提示词|全局\s*AI\s*提示词/.test(text)) return true;
  if (/全局.*(?:AI\s*)?(?:生成)?(?:视频)?提示词/.test(text) && /口播/.test(text)) {
    return true;
  }
  return false;
}

/** 方案① directVideo 是否已有可展示/可生成的实质内容 */
export function hasSeedVideoDirectPlanReady(
  directVideo: SeedVideoProject["plan"] extends null | undefined
    ? never
    : NonNullable<SeedVideoProject["plan"]>["directVideo"] | null | undefined,
): boolean {
  if (!directVideo) return false;
  if (directVideo.globalPrompt?.trim()) return true;
  if (directVideo.fullVoiceover?.trim()) return true;
  if ((directVideo.shotSequence?.length ?? 0) > 0) return true;
  return false;
}

/** 方案①：助手已输出直接连贯成片参数，待用户点选确认/重新生成 */
export function findPendingDirectPlanMarkdown(project: SeedVideoProject): string {
  if (!isDirectMode(project) || !isSeedVideoProductionWorkspaceReady(project)) return "";

  let planMarkdown = "";
  let userConfirmed = false;

  for (let i = project.chatHistory.length - 1; i >= 0; i--) {
    const m = project.chatHistory[i]!;
    if (m.role === "user" && isDirectPlanConfirmChoice(m.content)) {
      userConfirmed = true;
      break;
    }
    if (m.role === "assistant" && isDirectPlanAssistantContent(m.content)) {
      planMarkdown = m.content.trim();
      break;
    }
  }

  if (!planMarkdown || userConfirmed) return "";
  if (project.meta?.workflow?.planSynced && hasSeedVideoDirectPlanReady(project.plan?.directVideo)) {
    return "";
  }
  return planMarkdown;
}

function buildDirectPlanReviewChoices(): SeedVideoAssistantChoice[] {
  return [
    {
      id: "direct-regenerate",
      label: "重新生成",
      title: "重新生成",
      description: "对当前直接连贯参数不满意，按原脚本重新出一版",
      message: DIRECT_PLAN_REGENERATE_MESSAGE,
      kind: "review",
    },
    {
      id: "direct-confirm",
      label: "确认并同步",
      title: "确认成片参数",
      description: "确认无误，同步到中间工作区开始生成视频",
      message: DIRECT_PLAN_CONFIRM_MESSAGE,
      recommended: true,
      kind: "review",
    },
  ];
}

export function planSyncedToProduction(project: SeedVideoProject): boolean {
  if (findPendingFormalScriptMarkdown(project)) return false;
  if (findPendingDirectPlanMarkdown(project)) return false;
  if (project.meta?.workflow?.planSynced) return true;
  const lastUser = [...project.chatHistory].reverse().find((m) => m.role === "user");
  if (
    lastUser &&
    isFinalShotsConfirmChoice(lastUser.content) &&
    (project.plan?.shots?.length ?? 0) > 0
  ) {
    return true;
  }
  if (
    lastUser &&
    isDirectPlanConfirmChoice(lastUser.content) &&
    hasSeedVideoDirectPlanReady(project.plan?.directVideo)
  ) {
    return true;
  }
  return false;
}

export function findPlanMarkdownForSync(project: SeedVideoProject): string {
  const fromMeta =
    typeof project.meta?.lastAssistantRaw === "string" ? project.meta.lastAssistantRaw.trim() : "";
  if (fromMeta && !isSeedVideoScriptProposalMarkdown(fromMeta) && hasSeedVideoShotsTableMarkdown(fromMeta)) {
    return fromMeta;
  }
  if (fromMeta && isDirectPlanAssistantContent(fromMeta)) return fromMeta;

  for (const m of [...project.chatHistory].reverse()) {
    const t = m.content.trim();
    if (isSeedVideoScriptProposalMarkdown(t)) continue;
    if (hasSeedVideoShotsTableMarkdown(t)) return t;
    if (isDirectPlanAssistantContent(t)) return t;
  }
  return fromMeta && !isSeedVideoScriptProposalMarkdown(fromMeta) ? fromMeta : "";
}

export function findDirectPlanMarkdownForSync(project: SeedVideoProject): string {
  for (const m of [...project.chatHistory].reverse()) {
    if (m.role === "assistant" && isDirectPlanAssistantContent(m.content)) {
      return m.content.trim();
    }
  }
  const fromMeta =
    typeof project.meta?.lastAssistantRaw === "string" ? project.meta.lastAssistantRaw.trim() : "";
  return fromMeta && isDirectPlanAssistantContent(fromMeta) ? fromMeta : "";
}

const SCRIPT_CHOICE_META = [
  {
    title: "脚本一：氛围感切入",
    description: "清冷文艺 x 松弛感穿搭，主打不费力的高级感",
    recommended: true,
  },
  {
    title: "脚本二：痛点切入",
    description: "梨形身材天菜，主打遮肉显瘦",
  },
  {
    title: "脚本三：场景切入",
    description: "度假出片指南，主打旅行种草",
  },
] as const;

const MODE_CHOICE_META = [
  {
    title: "方案①：直接连贯生成视频",
    description: "一条连贯成片（时长由策划 Prompt 决定，默认约 20s），适合快节奏种草",
  },
  {
    title: "方案②：按精细成片流程制作",
    description: "逐镜 I2V + TTS + 合成，适合精细控制",
  },
] as const;

const STYLE_CHOICE_META = [
  {
    title: "A方案：甜美种草风（小红书）",
    description: "湾湾小何音色，轻快甜美 BGM，姐妹分享感",
  },
  {
    title: "B方案：干练安利风（抖音带货）",
    description: "爽快思思音色，节奏感卡点 BGM，短促有力",
  },
] as const;

const GENERATE_ALL_CHOICE: SeedVideoAssistantChoice = {
  id: "generate-all",
  label: "全部生成",
  title: "全部生成",
  description: "3 套脚本全部生成视频",
  message: "全部生成：3 套脚本全部生成视频",
  kind: "generate-all",
};

function allSkillScriptChoiceLabels(): string[] {
  return listSeedVideoSkillDefinitions().flatMap((s) => [...s.scriptChoiceLabels]);
}

const ALL_FIXED_CHOICES = [
  ...allSkillScriptChoiceLabels(),
  ...MODE_CHOICES,
  ...STYLE_CHOICES,
  "A方案：甜美种草带货风（小红书向）",
  "B方案：强转化干练带货风（抖音短视频带货向）",
] as const;

const SCRIPT_MARKERS = ["①", "②", "③"] as const;

function lastAssistant(project: SeedVideoProject): string | null {
  const last = [...project.chatHistory].reverse().find((m) => m.role === "assistant");
  return last?.content?.trim() ?? null;
}

function isScriptSelectionMessage(content: string): boolean {
  const t = content.trim();
  if (allSkillScriptChoiceLabels().includes(t)) return true;
  if ((SCRIPT_CHOICES as readonly string[]).includes(t)) return true;
  if (/^全部生成/.test(t)) return true;
  if (/^我选择方案[①②③123ABCabc]/.test(t)) return true;
  if (/^我选择成片风格[①②③123]/.test(t)) return true;
  if (/^(?:选|我要)方案\s*[ABCabc]/.test(t)) return true;
  if (/^选[①②③123]/.test(t)) return true;
  if (/^脚本[一二三1-3]/.test(t)) return true;
  if (/^【?[123]】?$/.test(t)) return true;
  return false;
}

function isModeSelectionMessage(content: string): boolean {
  const t = content.trim();
  if ((MODE_CHOICES as readonly string[]).includes(t)) return true;
  if (/直接连贯|一次性生成完整/.test(t) && /方案[①1]|我选择方案[①1]/i.test(t)) {
    return true;
  }
  if (/精细成片|逐镜执行表|分镜执行表/.test(t) && /方案[②2]|我选择方案[②2]/i.test(t)) {
    return true;
  }
  if (/^我选择方案[①1][：:].*(?:直接连贯|一次性)/i.test(t)) return true;
  if (/^我选择方案[②2][：:].*(?:精细成片|逐镜|分镜)/i.test(t)) return true;
  return false;
}

export function isStyleSelectionMessage(content: string): boolean {
  const t = content.trim();
  if ((STYLE_CHOICES as readonly string[]).includes(t)) return true;
  if (/^我选择成片风格[①②③123]/.test(t)) return true;
  if (/^选成片风格[①②③123]/.test(t)) return true;
  if (/^A方案：/.test(t)) return true;
  if (/^B方案：/.test(t)) return true;
  if (/^选[①②③123]$/.test(t) && /成片风格|复古胶片|柔光梦幻|极简杂志|甜美种草|干练安利/.test(t)) {
    return true;
  }
  return false;
}

type SeedVideoWorkflowContext = Pick<SeedVideoProject, "chatHistory" | "meta">;

export function userPickedScript(project: SeedVideoWorkflowContext): boolean {
  if (project.meta?.workflow?.selectedScriptId) return true;
  return project.chatHistory.some(
    (m) => m.role === "user" && isScriptSelectionMessage(m.content),
  );
}

export function userPickedMode(project: SeedVideoWorkflowContext): boolean {
  if (project.meta?.workflow?.productionMode) return true;
  if (
    project.chatHistory.some(
      (m) => m.role === "user" && isModeSelectionMessage(m.content),
    )
  ) {
    return true;
  }
  return project.chatHistory.some(
    (m) =>
      m.role === "assistant" &&
      /请选择成片风格|定调成片风格|请点选.*成片风格/.test(m.content),
  );
}

export function userPickedStyle(project: SeedVideoWorkflowContext): boolean {
  if (project.meta?.workflow?.stylePreset) return true;
  if (!userPickedFineMode(project)) return false;
  return project.chatHistory.some(
    (m) => m.role === "user" && isStyleSelectionMessage(m.content),
  );
}

/** 中间工作区 / plan 同步门禁：须完成脚本 + 制作模式（方案② 还须 A/B 成片风格） */
export function isSeedVideoProductionWorkspaceReady(
  project: SeedVideoWorkflowContext,
): boolean {
  if (!userPickedScript(project)) return false;
  if (!userPickedMode(project)) return false;
  if (userPickedFineMode(project) && !userPickedStyle(project)) return false;
  return true;
}

export function parseSeedVideoProductionModeFromChoice(
  text: string,
): SeedVideoProductionMode | null {
  const t = text.trim();
  if ((MODE_CHOICES as readonly string[]).includes(t)) {
    return t.startsWith("方案①") ? "direct" : "fine";
  }
  if (/直接连贯|一次性生成完整/.test(t) && /方案[①1]|我选择方案[①1]/i.test(t)) {
    return "direct";
  }
  if (/精细成片|逐镜执行表|分镜执行表/.test(t) && /方案[②2]|我选择方案[②2]/i.test(t)) {
    return "fine";
  }
  if (/^我选择方案[①1][：:].*(?:直接连贯|一次性)/i.test(t)) return "direct";
  if (/^我选择方案[②2][：:].*(?:精细成片|逐镜|分镜)/i.test(t)) return "fine";
  if (/^方案[①1][：:].*直接连贯/i.test(t)) return "direct";
  if (/^方案[②2][：:].*精细成片/i.test(t)) return "fine";
  return null;
}

export function parseSeedVideoScriptIdFromChoice(
  text: string,
): "script-1" | "script-2" | "script-3" | null {
  if (parseSeedVideoProductionModeFromChoice(text)) return null;
  const t = text.trim();
  if (/^【?1】?$/.test(t)) return "script-1";
  if (/^【?2】?$/.test(t)) return "script-2";
  if (/^【?3】?$/.test(t)) return "script-3";
  if (/^选[①1]$|^我选择方案[①1](?!.*直接连贯)/i.test(t)) return "script-1";
  if (/^选[②2]$|^我选择方案[②2](?!.*精细成片)/i.test(t)) return "script-2";
  if (/^选[③3]$|^我选择方案[③3]/.test(t)) return "script-3";
  if (/脚本一|方案一|方案\s*[Aa]|选方案\s*[Aa]|我选择方案\s*[Aa]/i.test(t)) return "script-1";
  if (/脚本二|方案二|方案\s*[Bb]|选方案\s*[Bb]|我选择方案\s*[Bb]/i.test(t)) return "script-2";
  if (/脚本三|方案三|方案\s*[Cc]|选方案\s*[Cc]|我选择方案\s*[Cc]/i.test(t)) return "script-3";
  if (/^全部生成/.test(t)) return "script-1";
  if (/^我选择成片风格[①1][：:]/i.test(t)) return "script-1";
  if (/^我选择成片风格[②2][：:]/i.test(t)) return "script-2";
  if (/^我选择成片风格[③3][：:]/i.test(t)) return "script-3";
  if (/^我选择方案[①1][：:]/i.test(t)) return "script-1";
  if (/^我选择方案[②2][：:]/i.test(t)) return "script-2";
  if (/^我选择方案[③3][：:]/i.test(t)) return "script-3";
  if ((SCRIPT_CHOICES as readonly string[]).includes(t)) {
    if (t.startsWith("脚本一")) return "script-1";
    if (t.startsWith("脚本二")) return "script-2";
    return "script-3";
  }
  if (allSkillScriptChoiceLabels().includes(t)) {
    if (t.startsWith("脚本一")) return "script-1";
    if (t.startsWith("脚本二")) return "script-2";
    return "script-3";
  }
  return null;
}

export function mergeSeedVideoWorkflowFromUserChoice(
  prev: NonNullable<SeedVideoProject["meta"]>["workflow"] | undefined,
  userText: string,
): NonNullable<SeedVideoProject["meta"]>["workflow"] {
  const next = { ...(prev ?? {}) };
  const mode = parseSeedVideoProductionModeFromChoice(userText);
  if (mode) {
    next.productionMode = mode;
    next.phase = mode === "fine" ? "style" : "production";
    return next;
  }
  const scriptId = parseSeedVideoScriptIdFromChoice(userText);
  if (scriptId) {
    next.selectedScriptId = scriptId;
    next.phase = "mode";
  }
  if (/^A方案：|^我选择成片风格[①1]/.test(userText.trim())) {
    next.stylePreset = "sweet-xhs";
    next.phase = "shots";
  }
  if (/^B方案：|^我选择成片风格[②2]/.test(userText.trim())) {
    next.stylePreset = "sharp-douyin";
    next.phase = "shots";
  }
  return next;
}

function buildMarkerChoice(
  kind: NonNullable<SeedVideoAssistantChoice["kind"]>,
  index: number,
  theme: string,
  marker?: string,
): SeedVideoAssistantChoice {
  const m = marker ?? SCRIPT_MARKERS[index] ?? String(index + 1);
  const clean = theme.trim().replace(/\s+/g, " ");
  const short = clean.split(/[·|｜，,]/)[0]?.trim() ?? clean.slice(0, 20);
  const title = `${m} ${short}`;
  return {
    id: `${kind}-${index + 1}`,
    label: title,
    title,
    description: clean,
    recommended: index === 0,
    kind,
    message:
      kind === "style"
        ? `我选择成片风格${m}：${clean}`
        : kind === "mode"
          ? `我选择方案${m}：${clean}`
          : `我选择方案${m}：${clean}`,
  };
}

function parseTableCircledChoices(
  text: string,
  kind: NonNullable<SeedVideoAssistantChoice["kind"]>,
): SeedVideoAssistantChoice[] {
  const parsed: SeedVideoAssistantChoice[] = [];
  for (let i = 0; i < SCRIPT_MARKERS.length; i++) {
    const marker = SCRIPT_MARKERS[i]!;
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rowRe = new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*([^|\\n]+)`, "i");
    const match = rowRe.exec(text);
    if (!match?.[1]) continue;
    const theme = match[1].trim();
    if (theme.length < 2) continue;
    parsed.push(buildMarkerChoice(kind, i, theme, marker));
  }
  return parsed.length >= 2 ? parsed : [];
}

function buildDefaultStyleChoices(): SeedVideoAssistantChoice[] {
  return STYLE_CHOICES.map((choice, index) => {
    const meta = STYLE_CHOICE_META[index]!;
    return {
      id: `style-${index + 1}`,
      label: choice,
      title: meta.title,
      description: meta.description,
      kind: "style" as const,
      message: choice,
    };
  });
}

const SCRIPT_NUM_LABELS = ["一", "二", "三"] as const;

function proposalToScriptChoice(
  proposal: ParsedScriptProposal,
  opts?: { recommended?: boolean },
): SeedVideoAssistantChoice {
  const numLabel = SCRIPT_NUM_LABELS[proposal.index] ?? String(proposal.index + 1);
  const scriptPrefix = `脚本${numLabel}`;
  const angle = proposal.angle.trim();
  const title = angle ? `${scriptPrefix}：${angle}` : scriptPrefix;
  const description = proposal.summary || angle;
  const message = angle ? `${scriptPrefix}：${angle}` : scriptPrefix;

  return {
    id: proposal.id,
    label: title,
    title,
    description,
    recommended: opts?.recommended ?? proposal.index === 0,
    kind: "script",
    message,
  };
}

function proposalFromSummaryRow(index: number, theme: string): ParsedScriptProposal {
  return {
    id: scriptIdFromProposalIndex(index),
    index,
    angle: theme,
    totalDurationSec: 0,
    summary: theme,
  };
}

function buildScriptChoicesFromParsedMarkdown(text: string): SeedVideoAssistantChoice[] {
  const patch = extractSeedVideoStructuredPatch(text);
  if (!patch?.scripts || patch.scripts.length !== 3) return [];

  const proposals = scriptProposalsFromStructuredPatch(patch);
  if (proposals.length !== 3) return [];

  return [
    ...proposals.map((p, i) =>
      proposalToScriptChoice(
        {
          id: p.id,
          index: p.index,
          angle: p.angle,
          totalDurationSec: 0,
          summary: p.summary,
        },
        { recommended: i === 0 },
      ),
    ),
    GENERATE_ALL_CHOICE,
  ];
}

function buildDefaultScriptChoices(project: SeedVideoProject): SeedVideoAssistantChoice[] {
  const labels = getSeedVideoSkillDefinition(
    resolveSeedVideoSkillKey(project.settings.skillKey),
  ).scriptChoiceLabels;
  return [
    ...labels.map((choice, index) => ({
      id: `script-${index + 1}`,
      label: choice,
      title: choice,
      description: choice.replace(/^脚本[一二三]：/, ""),
      recommended: index === 0 ? true : undefined,
      kind: "script" as const,
      message: choice,
    })),
    GENERATE_ALL_CHOICE,
  ];
}

function hasThreeScriptTablesInMarkdown(text: string): boolean {
  const patch = extractSeedVideoStructuredPatch(text);
  return patch?.scripts?.length === 3;
}

/** 从助手 Markdown 解析脚本点选卡片（优先图 1 三套分镜表，禁止把镜号行误当选项） */
export function parseTableScriptChoices(text: string): SeedVideoAssistantChoice[] {
  return buildScriptChoicesFromParsedMarkdown(text);
}

function fallbackAbcScriptChoices(text: string): SeedVideoAssistantChoice[] {
  const letters = [...text.matchAll(/方案\s*([ABCabc])/g)]
    .map((m) => m[1]!.toUpperCase())
    .filter((l) => "ABC".includes(l));
  const unique = [...new Set(letters)];
  if (unique.length < 2) return [];
  return unique.slice(0, 3).map((letter) => {
    const idx = "ABC".indexOf(letter);
    return proposalToScriptChoice(proposalFromSummaryRow(idx >= 0 ? idx : 0, `方案${letter}`));
  });
}

function lastTurnAwaitingChoice(project: SeedVideoProject): boolean {
  const hist = project.chatHistory;
  if (!hist.length) return false;
  return hist[hist.length - 1]!.role === "assistant";
}

/** 正式脚本已产出、尚未点「确认并同步」时 */
export function findPendingFormalScriptMarkdown(project: SeedVideoProject): string {
  if (project.meta?.workflow?.editingStoryboard) return "";
  if (!isSeedVideoProductionWorkspaceReady(project)) return "";

  for (const m of [...project.chatHistory].reverse()) {
    if (m.role !== "assistant") continue;
    const c = m.content.trim();
    if (isSeedVideoScriptProposalMarkdown(c)) continue;
    if (isFinalShotsConfirmChoice(c)) continue;
    if (hasStructuredFormalShots(c)) return c;
    if (/视频分镜执行表|分镜执行表/.test(c) && !/正式脚本|请确认逐镜参数表|运镜参数表/.test(c)) {
      continue;
    }
    if (/请确认逐镜参数表/.test(c) && /\|/.test(c)) return c;
    if (/正式脚本/.test(c) && hasSeedVideoShotsTableMarkdown(c)) return c;
  }
  const fromMeta =
    typeof project.meta?.lastAssistantRaw === "string" ? project.meta.lastAssistantRaw.trim() : "";
  if (fromMeta && hasStructuredFormalShots(fromMeta)) return fromMeta;
  return "";
}

export function resolvePendingDirectPlanPreview(project: SeedVideoProject): SeedVideoDirectPlan | null {
  if (hasSeedVideoDirectPlanReady(project.plan?.directVideo)) return null;
  for (const text of [
    typeof project.meta?.lastAssistantRaw === "string" ? project.meta.lastAssistantRaw.trim() : "",
    ...[...project.chatHistory].reverse().filter((m) => m.role === "assistant").map((m) => m.content.trim()),
  ]) {
    if (!text) continue;
    if (/正式脚本|AI\s*视频生成提示词/.test(text) && !hasStructuredDirectPlan(text)) continue;
    const directPlan = resolveDirectPlanFromAssistantText(text);
    if (directPlan) return directPlan;
  }
  return null;
}

function lastAssistantScriptProposal(project: SeedVideoProject): string | null {
  for (const m of [...project.chatHistory].reverse()) {
    if (m.role !== "assistant") continue;
    const t = m.content.trim();
    if (isSeedVideoScriptProposalMarkdown(t)) return t;
    if (isAwaitingScriptChoice(t)) return t;
    if (parseTableScriptChoices(t).length >= 2) return t;
  }
  return null;
}

function resolveScriptStepChoices(project: SeedVideoProject): SeedVideoAssistantChoice[] {
  const text = lastAssistantScriptProposal(project);
  if (!text) return [];
  const fromJson = buildScriptChoicesFromParsedMarkdown(text);
  if (fromJson.length > 0) return fromJson;
  return buildDefaultScriptChoices(project);
}

function buildStoryboardReviewChoices(): SeedVideoAssistantChoice[] {
  return [
    {
      id: "review-regenerate",
      label: "重新生成",
      title: "重新生成",
      description: "对当前分镜执行表不满意，按原条件重新出一版",
      message: STORYBOARD_REVIEW_CHOICE_MESSAGES[0]!,
      kind: "review",
    },
    {
      id: "review-edit",
      label: "修改脚本",
      title: "修改脚本",
      description: "在中间工作区编辑逐镜参数，改完一键同步",
      message: EDIT_STORYBOARD_CHOICE_MESSAGE,
      kind: "review",
    },
    {
      id: "review-duration",
      label: "修改分镜时长",
      title: "修改分镜时长",
      description: "调整各镜头时长分配后再更新表格",
      message: STORYBOARD_REVIEW_CHOICE_MESSAGES[1]!,
      kind: "review",
    },
    {
      id: "review-bgm",
      label: "替换 BGM 建议",
      title: "替换 BGM 建议",
      description: "更换背景音乐推荐与制作说明",
      message: STORYBOARD_REVIEW_CHOICE_MESSAGES[2]!,
      kind: "review",
    },
    {
      id: "review-next",
      label: "确认正式脚本",
      title: "确认并同步正式脚本",
      description: "将当前分镜转为逐镜参数表并同步到中间工作区",
      message: STORYBOARD_REVIEW_CHOICE_MESSAGES[3]!,
      recommended: true,
      kind: "review",
    },
  ];
}

function buildFinalShotsReviewChoices(): SeedVideoAssistantChoice[] {
  return [
    {
      id: "shots-regenerate",
      label: "重新生成",
      title: "重新生成",
      description: "对当前逐镜参数表不满意，按原条件重新出一版",
      message: FINAL_SHOTS_REVIEW_CHOICE_MESSAGES[0]!,
      kind: "shots",
    },
    {
      id: "shots-edit",
      label: "修改脚本",
      title: "修改脚本",
      description: "在中间工作区编辑运镜 / 画面 / 口播 / 提示词",
      message: EDIT_STORYBOARD_CHOICE_MESSAGE,
      kind: "shots",
    },
    {
      id: "shots-duration",
      label: "修改分镜时长",
      title: "修改分镜时长",
      description: "调整各镜头时长分配后再更新表格",
      message: STORYBOARD_REVIEW_CHOICE_MESSAGES[1]!,
      kind: "shots",
    },
    {
      id: "shots-confirm",
      label: "确认并同步",
      title: "确认逐镜参数表",
      description: "确认无误，同步到中间工作区开始成片",
      message: FINAL_SHOTS_REVIEW_CHOICE_MESSAGES[1]!,
      recommended: true,
      kind: "shots",
    },
  ];
}

function isStoryboardReviewSelectionMessage(content: string): boolean {
  const t = content.trim();
  return (STORYBOARD_REVIEW_CHOICE_MESSAGES as readonly string[]).some(
    (m) => t === m || t.startsWith(m.split("：")[0]!),
  );
}

function isFinalShotsReviewSelectionMessage(content: string): boolean {
  const t = content.trim();
  if (t === EDIT_STORYBOARD_CHOICE_MESSAGE) return true;
  if (t === STORYBOARD_REVIEW_CHOICE_MESSAGES[1]) return true;
  return (FINAL_SHOTS_REVIEW_CHOICE_MESSAGES as readonly string[]).some(
    (m) => t === m || t.startsWith(m.split("：")[0]!),
  );
}

function isStoryboardExecutionTableContext(text: string): boolean {
  if (/视频分镜执行表|分镜执行表/.test(text)) return true;
  if (/运镜方式/.test(text) && /口播文案/.test(text) && /制作说明/.test(text)) return true;
  if (/运镜方式|运镜参数/.test(text) && /画面特效|转场|对应素材/.test(text)) return true;
  return false;
}

function isAwaitingStoryboardReviewChoice(text: string): boolean {
  if (!/\|/.test(text)) return false;
  if (isStoryboardExecutionTableContext(text)) return true;
  if (/是否需要修改分镜时长/.test(text)) return true;
  if (/替换.*BGM/i.test(text) && /生成正式脚本|下一步/.test(text)) return true;
  return false;
}

function isAwaitingFinalShotsChoice(text: string): boolean {
  if (!/\|/.test(text)) return false;
  if (isStoryboardExecutionTableContext(text)) return false;
  if (/正式脚本/.test(text)) return true;
  if (!hasSeedVideoShotsTableMarkdown(text)) return false;
  if (/素材映射/.test(text) && /镜号|序号/.test(text)) return true;
  if (
    /时间切片/.test(text) &&
    /参考素材|镜头描述/.test(text) &&
    /AI\s*视频生成提示词|AI提示词/.test(text)
  ) {
    return true;
  }
  return false;
}

function isNonScriptChoiceContext(text: string): boolean {
  if (/请选择成片风格|定调成片风格|成片风格方案/.test(text)) return true;
  if (/请选择视频制作模式/.test(text)) return true;
  if (/风格名称|视觉特点|滤镜质感|字幕风格|color grading/i.test(text)) return true;
  if (/视频分镜执行表|分镜执行表|运镜方式|制作说明/.test(text)) return true;
  if (/镜号/.test(text) && /AI视频生成提示词|AI提示词/.test(text)) return true;
  if (/成片风格|定调成片风格|视觉风格/.test(text) && /[①②③]/.test(text) && /\|/.test(text)) {
    return true;
  }
  return false;
}

function isExpandedSingleScriptOutput(text: string): boolean {
  return (
    /脚本方案[：:]/i.test(text) &&
    /镜号|序号/.test(text) &&
    !(/脚本一/.test(text) && /脚本二/.test(text) && /脚本三/.test(text))
  );
}

function isAwaitingScriptChoice(text: string): boolean {
  if (isNonScriptChoiceContext(text)) return false;
  if (isExpandedSingleScriptOutput(text)) return false;
  if (/请选择你想要使用的脚本|请选择脚本|请选择你喜欢的脚本/.test(text)) return true;
  if (/给我选择.*脚本|请选择.*脚本/.test(text)) return true;
  if (hasThreeScriptTablesInMarkdown(text)) return true;
  if (/```seed-video/.test(text) && /await_script_choice|"step"\s*:\s*"scripts"/.test(text)) {
    return true;
  }
  return false;
}

function parseTableModeChoices(text: string): SeedVideoAssistantChoice[] {
  const parsed: SeedVideoAssistantChoice[] = [];

  for (let i = 0; i < SCRIPT_MARKERS.length; i++) {
    const marker = SCRIPT_MARKERS[i]!;
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rowRe = new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*([^|\\n]+)`, "i");
    const match = rowRe.exec(text);
    if (!match?.[1]) continue;
    const theme = match[1].trim();
    if (theme.length < 2) continue;
    parsed.push(buildMarkerChoice("mode", i, theme, marker));
  }
  if (parsed.length >= 2) return parsed;

  const numberedRows = [
    ...text.matchAll(/\|\s*(?:模式?\s*)?([1-3]|①|②|③)\s*\|\s*([^|\n]+)/g),
  ];
  if (numberedRows.length >= 2) {
    return numberedRows.slice(0, 3).map((m, index) => {
      const raw = m[1]!;
      const idx =
        SCRIPT_MARKERS.indexOf(raw as (typeof SCRIPT_MARKERS)[number]) >= 0
          ? SCRIPT_MARKERS.indexOf(raw as (typeof SCRIPT_MARKERS)[number])
          : parseInt(raw, 10) - 1;
      const safeIdx = idx >= 0 ? idx : index;
      return buildMarkerChoice("mode", safeIdx, (m[2] ?? "").trim(), SCRIPT_MARKERS[safeIdx]);
    });
  }

  return [];
}

function isAwaitingModeChoice(text: string): boolean {
  if (/请选择视频制作模式|请点选.*制作模式|确认制作模式/.test(text)) return true;
  if (parseTableModeChoices(text).length >= 2) return true;
  if (parseTableCircledChoices(text, "mode").length >= 2) return true;
  return (
    /制作模式/.test(text) &&
    (/方案[①②12]|模式\s*[123①②③]|智能卡点|慢镜头|图文动态|直接连贯|精细成片|Ken|推拉/.test(
      text,
    ))
  );
}

function isAwaitingStyleChoice(text: string): boolean {
  if (/请选择成片风格/.test(text)) return true;
  if (/资深广告导演|请你挑选最终执行|套不同风格/.test(text) && /A方案|B方案|成片风格/.test(text)) {
    return true;
  }
  if (/成片风格/.test(text) && /A方案/.test(text) && /B方案/.test(text)) return true;
  if (/成片风格|定调成片风格|视觉风格/.test(text) && /[①②③]/.test(text) && /\|/.test(text)) {
    return true;
  }
  if (parseTableCircledChoices(text, "style").length >= 2) return true;
  return false;
}

export function inferWorkflowPhase(project: SeedVideoProject): SeedVideoWorkflowPhase {
  if (project.references.length === 0) return "material";
  if (project.chatHistory.length === 0) return "material";
  if (!userPickedScript(project)) return "scripts";
  if (!userPickedMode(project)) return "mode";
  if (userPickedFineMode(project) && !userPickedStyle(project)) return "style";
  if (isDirectMode(project)) return "production";
  if ((project.plan?.shots?.length ?? 0) > 0) {
    return planSyncedToProduction(project) ? "production" : "shots";
  }
  return "production";
}

export function userPickedFineMode(project: SeedVideoWorkflowContext): boolean {
  if (project.meta?.workflow?.productionMode === "fine") return true;
  return project.chatHistory.some(
    (m) => m.role === "user" && /方案②|精细成片/.test(m.content),
  );
}

export function inferAssistantChoices(project: SeedVideoProject): SeedVideoAssistantChoice[] {
  if (project.meta?.workflow?.editingStoryboard) return [];
  if (planSyncedToProduction(project)) return [];

  const phase = inferWorkflowPhase(project);

  // Step1：脚本方案（未选脚本前，禁止出现后续步骤选项）
  if (phase === "scripts" || !userPickedScript(project)) {
    return resolveScriptStepChoices(project);
  }

  // Step2：制作模式
  if (phase === "mode" || !userPickedMode(project)) {
    return buildModeChoicesList();
  }

  // Step3：成片风格（仅方案②）
  if (phase === "style" || (userPickedFineMode(project) && !userPickedStyle(project))) {
    const text = lastAssistant(project) ?? "";
    const parsed = parseTableCircledChoices(text, "style");
    if (parsed.length >= 2) return parsed;
    return buildDefaultStyleChoices();
  }

  // Step4+：须完成前置门禁
  if (!isSeedVideoProductionWorkspaceReady(project)) return [];

  // 方案②：正式逐镜参数表（优先于方案①，避免误出「确认成片参数」）
  const pendingFormal = findPendingFormalScriptMarkdown(project);
  if (userPickedFineMode(project) && pendingFormal) {
    return buildFinalShotsReviewChoices();
  }

  // 方案①：直接连贯成片参数确认
  if (isDirectMode(project) && findPendingDirectPlanMarkdown(project)) {
    return buildDirectPlanReviewChoices();
  }

  if (pendingFormal) return buildFinalShotsReviewChoices();

  // 方案②：分镜执行表确认（不依赖 lastTurnAwaitingChoice，避免用户点选后卡片消失）
  if (userPickedFineMode(project) && userPickedStyle(project)) {
    const text = lastAssistant(project) ?? "";
    if (!isAssistantPostSyncAck(text) && isAwaitingStoryboardReviewChoice(text)) {
      return buildStoryboardReviewChoices();
    }
  }

  return [];
}

export function choicePrompt(project: SeedVideoProject): string {
  return choicePromptBlock(project).subtitle;
}

export function choicePromptBlock(project: SeedVideoProject): {
  title: string;
  subtitle: string;
} {
  const phase = inferWorkflowPhase(project);

  if (phase === "scripts" || !userPickedScript(project)) {
    return {
      title: "请选择你喜欢的脚本方案，确认后我为你执行生成",
      subtitle: "选择脚本（单选）",
    };
  }
  if (phase === "mode" || !userPickedMode(project)) {
    return {
      title: "请选择视频制作模式",
      subtitle: "选择制作模式（单选）",
    };
  }
  if (phase === "style" || (userPickedFineMode(project) && !userPickedStyle(project))) {
    return {
      title: "请选择成片风格",
      subtitle: "资深广告导演 A/B 成片方案（口播/音色/BGM 不同，单选）",
    };
  }
  if (findPendingDirectPlanMarkdown(project)) {
    return {
      title: "请确认直接连贯成片参数",
      subtitle: "可重新生成或确认后同步到中间工作区（单选）",
    };
  }
  if (findPendingFormalScriptMarkdown(project)) {
    return {
      title: "请确认逐镜参数表",
      subtitle: "可重新生成、修改脚本、微调时长，或同步到工作区（单选）",
    };
  }
  const text = lastAssistant(project) ?? "";
  if (isAwaitingStoryboardReviewChoice(text)) {
    return {
      title: "请确认分镜执行表",
      subtitle: "可重新生成、修改脚本、微调，或确认后一步同步正式脚本",
    };
  }
  return { title: "请选择", subtitle: "点选即可，无需输入" };
}

export type SeedVideoAssistantChoiceUiState = {
  showLive: boolean;
  /** 同一步骤已有助手回复时，隐藏历史点选卡片，仅展示下方 live */
  suppressSnapshotMessageId: string | null;
};

/** 同一步骤的点选卡片只展示一处（历史或 live，不重复） */
export function resolveAssistantChoiceUiState(
  project: SeedVideoProject,
): SeedVideoAssistantChoiceUiState {
  const choices = inferAssistantChoices(project);
  const block = choicePromptBlock(project);
  if (!choices.length) {
    return { showLive: false, suppressSnapshotMessageId: null };
  }

  const history = project.chatHistory.filter(
    (m) => m.id !== "welcome" && m.id !== "streaming" && !m.id.startsWith("err-"),
  );

  let lastUserChoiceIndex = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i]!;
    if (m.role === "user" && isSeedVideoChoiceMessage(m.content)) {
      lastUserChoiceIndex = i;
      break;
    }
  }
  if (lastUserChoiceIndex < 0) {
    return { showLive: true, suppressSnapshotMessageId: null };
  }

  const userMsg = history[lastUserChoiceIndex]!;
  const snapshot =
    userMsg.choiceSnapshot ??
    reconstructChoiceSnapshot(history, lastUserChoiceIndex, project);
  if (!snapshot || snapshot.title !== block.title) {
    return { showLive: true, suppressSnapshotMessageId: null };
  }

  const assistantRepliedAfter = history
    .slice(lastUserChoiceIndex + 1)
    .some((m) => m.role === "assistant" && m.content.trim().length > 0);

  if (!assistantRepliedAfter) {
    return { showLive: false, suppressSnapshotMessageId: null };
  }

  return { showLive: true, suppressSnapshotMessageId: userMsg.id };
}

export function resolveSeedVideoPlanningPrompt(project: SeedVideoProject): string {
  const fromMeta =
    typeof project.meta?.planningPrompt === "string" ? project.meta.planningPrompt.trim() : "";
  if (fromMeta) return fromMeta;
  const firstPlanning = project.chatHistory.find(
    (m) => m.role === "user" && !isSeedVideoChoiceMessage(m.content),
  );
  const fromHistory = firstPlanning?.content?.trim();
  if (fromHistory) return fromHistory;
  return getSeedVideoSkillDefinition(resolveSeedVideoSkillKey(project.settings.skillKey))
    .defaultPlanningPrompt;
}

export function normalizeSeedVideoChoiceInput(
  text: string,
  project: SeedVideoProject,
): string | null {
  const t = text.trim();
  if (!t) return null;
  if (/\|.+\|/.test(t) && t.includes("\n")) return null;

  const choices = inferAssistantChoices(project);
  if (choices.length === 0) return null;

  const byMessage = choices.find((c) => c.message === t);
  if (byMessage) return byMessage.message;

  const byLabel = choices.find((c) => c.label === t);
  if (byLabel) return byLabel.message;

  const idxMatch = t.match(/^【?([123])】?$|^选([123])$|^方案([123])$/);
  if (idxMatch) {
    const idx = parseInt(idxMatch[1] ?? idxMatch[2] ?? idxMatch[3] ?? "", 10) - 1;
    if (idx >= 0 && idx < choices.length) return choices[idx]!.message;
  }

  const circled = t.match(/^选?([①②③])$/);
  if (circled) {
    const idx = SCRIPT_MARKERS.indexOf(circled[1] as (typeof SCRIPT_MARKERS)[number]);
    if (idx >= 0 && idx < choices.length) return choices[idx]!.message;
  }

  const stylePick = t.match(/^我选择成片风格([①②③123])(?:[：:].*)?$/);
  if (stylePick) {
    const idx = SCRIPT_MARKERS.indexOf(
      stylePick[1] as (typeof SCRIPT_MARKERS)[number],
    );
    if (idx < 0) {
      const n = parseInt(stylePick[1]!, 10) - 1;
      if (n >= 0 && n < choices.length) return choices[n]!.message;
    } else if (idx >= 0 && idx < choices.length) {
      return choices[idx]!.message;
    }
  }

  if (/^方案[①1]$/.test(t) && choices.length >= 1) return choices[0]!.message;
  if (/^方案[②2]$/.test(t) && choices.length >= 2) return choices[1]!.message;
  if (/^方案[③3]$/.test(t) && choices.length >= 3) return choices[2]!.message;

  const abcPick = t.match(/^(?:我(?:选择|要)|选)?方案\s*([ABCabc])(?:[：:].*)?$/);
  if (abcPick) {
    const idx = "ABC".indexOf(abcPick[1]!.toUpperCase());
    if (idx >= 0 && idx < choices.length) return choices[idx]!.message;
  }

  if (/^[Aa]$/.test(t)) {
    const hit = choices.find((c) => c.label.startsWith("A") || c.message.startsWith("A"));
    if (hit) return hit.message;
  }
  if (/^[Bb]$/.test(t)) {
    const hit = choices.find((c) => c.label.startsWith("B") || c.message.startsWith("B"));
    if (hit) return hit.message;
  }

  if ((ALL_FIXED_CHOICES as readonly string[]).includes(t)) return t;

  const reviewHit = (STORYBOARD_REVIEW_CHOICE_MESSAGES as readonly string[]).find(
    (m) => t === m,
  );
  if (reviewHit) return reviewHit;

  const shotsHit = (FINAL_SHOTS_REVIEW_CHOICE_MESSAGES as readonly string[]).find(
    (m) => t === m,
  );
  if (shotsHit) return shotsHit;

  return null;
}

export function isSeedVideoChoiceMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^全部生成/.test(t)) return true;
  if ((ALL_FIXED_CHOICES as readonly string[]).includes(t)) return true;
  if (/^我选择方案[①②③123ABCabc]/.test(t)) return true;
  if (/^我选择成片风格[①②③123]/.test(t)) return true;
  if (/^选成片风格[①②③123]/.test(t)) return true;
  if (/^(?:选|我要)方案\s*[ABCabc]/.test(t)) return true;
  if (/^选[①②③123]$/.test(t)) return true;
  if (/^【?[123]】?$/.test(t)) return true;
  if (/^方案[①②③123ABCabc]$/.test(t)) return true;
  if (/^[AaBbCc]$/.test(t)) return true;
  if (isFinalShotsConfirmChoice(t)) return true;
  if (isFinalShotsRegenerateChoice(t)) return true;
  if (isStoryboardReviewSelectionMessage(t)) return true;
  if (isFinalShotsReviewSelectionMessage(t)) return true;
  if (isDirectPlanConfirmChoice(t)) return true;
  if (isDirectPlanRegenerateChoice(t)) return true;
  return false;
}

export function stepVisual(
  current: SeedVideoWorkflowPhase,
  step: SeedVideoWorkflowPhase,
): "done" | "active" | "pending" {
  const order: SeedVideoWorkflowPhase[] = [
    "material",
    "scripts",
    "mode",
    "style",
    "shots",
    "production",
    "done",
  ];
  const ci = order.indexOf(current);
  const si = order.indexOf(step);
  if (si < ci) return "done";
  if (si === ci) return "active";
  return "pending";
}

export function isDirectMode(project: SeedVideoProject): boolean {
  if (project.meta?.workflow?.productionMode === "direct") return true;
  if (project.meta?.workflow?.productionMode === "fine") return false;
  return project.chatHistory.some(
    (m) =>
      m.role === "user" && parseSeedVideoProductionModeFromChoice(m.content) === "direct",
  );
}

export function resolveProductionModeLabel(project: SeedVideoProject): string {
  if (isDirectMode(project)) return "方案① · 直接连贯生成";
  if (userPickedFineMode(project)) return "方案② · 精细成片";
  return "种草视频成片";
}

export function filterVideoModelsForMode(
  modelKeys: string[],
  direct: boolean,
): string[] {
  const wan30 = "wan3.0-video";
  if (direct) {
    // 方案①整图成片：种草素材须走 R2V；同时保留 wan3.0 t2v / Seedance 备选
    return modelKeys.filter(
      (k) =>
        k === wan30 ||
        k.includes("seedance") ||
        k.includes("t2v") ||
        k.includes("r2v") ||
        k.includes("i2v"),
    );
  }
  return modelKeys.filter(
    (k) =>
      k !== wan30 &&
      (k.includes("r2v") ||
        k.includes("i2v") ||
        k.includes("kling") ||
        k.includes("seedance")),
  );
}

const SEED_VIDEO_DIRECT_PREFERRED_MODEL = "wan2.7-r2v";
const SEED_VIDEO_FINE_PREFERRED_MODEL = "wan2.7-r2v";

/** 按制作模式从 Gateway 列表中解析可用 videoModelKey（模式切换时回退；已选手动保留） */
export function resolveSeedVideoVideoModelKey(
  models: Array<{ modelKey: string; credentialBound?: boolean }>,
  currentKey: string,
  direct: boolean,
): string {
  const keys = filterVideoModelsForMode(
    models.map((m) => m.modelKey),
    direct,
  );
  const filtered = models.filter((m) => keys.includes(m.modelKey));
  if (filtered.length === 0) return currentKey;

  const currentInList = filtered.find((m) => m.modelKey === currentKey);
  if (currentInList) return currentInList.modelKey;

  const preferredKey = direct
    ? SEED_VIDEO_DIRECT_PREFERRED_MODEL
    : SEED_VIDEO_FINE_PREFERRED_MODEL;
  const preferred = filtered.find((m) => m.modelKey === preferredKey);
  if (preferred?.credentialBound) return preferred.modelKey;

  const anyBound = filtered.find((m) => m.credentialBound);
  if (anyBound) return anyBound.modelKey;
  if (preferred) return preferred.modelKey;
  return filtered[0]!.modelKey;
}

function formatSelectedScriptLabel(scriptId: string | undefined): string {
  if (scriptId === "script-1") return "脚本一「氛围感切入 — 不费力的高级」";
  if (scriptId === "script-2") return "脚本二「痛点切入 — 梨形身材天菜」";
  if (scriptId === "script-3") return "脚本三「场景切入 — 度假出片指南」";
  return "已选脚本";
}

/** 方案②点选后本地插入 Step4 引导语（不调 LLM），再展示 A/B 成片风格卡片 */
export function buildFineModeStyleIntroContent(project: SeedVideoProject): string {
  const scriptId = project.meta?.workflow?.selectedScriptId;
  const fromChat = [...project.chatHistory]
    .reverse()
    .find((m) => m.role === "user" && parseSeedVideoScriptIdFromChoice(m.content));
  const resolvedId =
    scriptId ??
    (fromChat ? parseSeedVideoScriptIdFromChoice(fromChat.content) ?? undefined : undefined);
  const label = formatSelectedScriptLabel(resolvedId);
  return `现在我以资深广告导演身份，基于你选定的${label}，为你设计 2 套不同风格的成片方案（口播风格/音色/BGM 不同），请你挑选最终执行的一套：

请选择成片风格：`;
}

function buildModeChoicesList(): SeedVideoAssistantChoice[] {
  return MODE_CHOICES.map((choice, index) => {
    const meta = MODE_CHOICE_META[index]!;
    return {
      id: `mode-${index + 1}`,
      label: choice,
      title: meta.title,
      description: meta.description,
      kind: "mode" as const,
      message: choice,
    };
  });
}

function findPrevAssistantContent(
  messages: SeedVideoChatMessage[],
  beforeIndex: number,
): string {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    if (messages[i]?.role === "assistant") return messages[i]!.content.trim();
  }
  return "";
}

export function resolveScriptChoicesFromMarkdown(text: string): SeedVideoAssistantChoice[] {
  return buildScriptChoicesFromParsedMarkdown(text);
}

export function resolveSelectedChoiceMessage(
  userContent: string,
  choices: SeedVideoAssistantChoice[],
): string {
  const t = userContent.trim();
  const exact = choices.find(
    (c) => c.message === t || c.label === t || c.title === t || c.message.trim() === t,
  );
  if (exact) return exact.message;

  const scriptId = parseSeedVideoScriptIdFromChoice(t);
  if (scriptId) {
    const idx = parseInt(scriptId.replace("script-", ""), 10) - 1;
    const byIdx = choices[idx];
    if (byIdx) return byIdx.message;
    const byKind = choices.find((c) => c.id === scriptId);
    if (byKind) return byKind.message;
  }

  const mode = parseSeedVideoProductionModeFromChoice(t);
  if (mode) {
    const hit = choices.find(
      (c) => parseSeedVideoProductionModeFromChoice(c.message) === mode,
    );
    if (hit) return hit.message;
  }

  if (isStyleSelectionMessage(t)) {
    const hit = choices.find(
      (c) =>
        c.message === t ||
        (t.startsWith("A") && c.message.startsWith("A")) ||
        (t.startsWith("B") && c.message.startsWith("B")),
    );
    if (hit) return hit.message;
  }

  const reviewHit = choices.find((c) => c.message === t);
  if (reviewHit) return reviewHit.message;

  return t;
}

export function buildChoiceSnapshotForSelection(
  project: SeedVideoProject,
  choice: string,
): SeedVideoChoiceSnapshot | null {
  const choices = inferAssistantChoices(project);
  if (!choices.length) return null;
  const block = choicePromptBlock(project);
  return {
    title: block.title,
    subtitle: block.subtitle,
    choices,
    selectedMessage: resolveSelectedChoiceMessage(choice, choices),
  };
}

export function reconstructChoiceSnapshot(
  messages: SeedVideoChatMessage[],
  userIndex: number,
  project: SeedVideoProject,
): SeedVideoChoiceSnapshot | null {
  const userMsg = messages[userIndex];
  if (!userMsg || userMsg.role !== "user") return null;
  if (userMsg.choiceSnapshot) return userMsg.choiceSnapshot;
  if (!isSeedVideoChoiceMessage(userMsg.content)) return null;

  const content = userMsg.content.trim();
  const assistantText = findPrevAssistantContent(messages, userIndex);

  if (parseSeedVideoProductionModeFromChoice(content)) {
    const choices = buildModeChoicesList();
    return {
      title: "请选择视频制作模式",
      subtitle: "选择制作模式（单选）",
      choices,
      selectedMessage: resolveSelectedChoiceMessage(content, choices),
    };
  }

  if (isStyleSelectionMessage(content)) {
    const parsed = parseTableCircledChoices(assistantText, "style");
    const choices = parsed.length >= 2 ? parsed : buildDefaultStyleChoices();
    return {
      title: "请选择成片风格",
      subtitle: "选择成片风格（单选）",
      choices,
      selectedMessage: resolveSelectedChoiceMessage(content, choices),
    };
  }

  if (isFinalShotsConfirmChoice(content) || isFinalShotsRegenerateChoice(content)) {
    const choices = buildFinalShotsReviewChoices();
    return {
      title: "请确认逐镜参数表",
      subtitle: "可重新生成、修改脚本、微调时长，或同步到工作区（单选）",
      choices,
      selectedMessage: resolveSelectedChoiceMessage(content, choices),
    };
  }

  if (isStoryboardReviewSelectionMessage(content)) {
    const choices = buildStoryboardReviewChoices();
    return {
      title: "请确认分镜执行表",
      subtitle: "可重新生成、修改脚本、微调，或确认后一步同步正式脚本",
      choices,
      selectedMessage: resolveSelectedChoiceMessage(content, choices),
    };
  }

  if (isScriptSelectionMessage(content)) {
    const choices = resolveScriptChoicesFromMarkdown(assistantText);
    return {
      title: "请选择你喜欢的脚本方案，确认后我为你执行生成",
      subtitle: "选择脚本（单选）",
      choices,
      selectedMessage: resolveSelectedChoiceMessage(content, choices),
    };
  }

  const histBefore = messages.slice(0, userIndex).filter(
    (m) => m.id !== "welcome" && m.id !== "streaming" && !m.id.startsWith("err-"),
  );
  const partialProject: SeedVideoProject = { ...project, chatHistory: histBefore };
  const fallbackChoices = inferAssistantChoices(partialProject);
  if (fallbackChoices.length) {
    const block = choicePromptBlock(partialProject);
    return {
      title: block.title,
      subtitle: block.subtitle,
      choices: fallbackChoices,
      selectedMessage: resolveSelectedChoiceMessage(content, fallbackChoices),
    };
  }

  return null;
}

export function buildUserMessageWithChoice(
  history: SeedVideoChatMessage[],
  choice: string,
  snapshot?: SeedVideoChoiceSnapshot | null,
): SeedVideoChatMessage[] {
  return [
    ...history,
    {
      id: `user-${Date.now()}`,
      role: "user",
      content: choice,
      createdAt: new Date().toISOString(),
      choiceSnapshot: snapshot ?? undefined,
    },
  ];
}

export type SeedVideoUserMessageDisplay =
  | { kind: "text"; text: string }
  | { kind: "markdown"; markdown: string; actionLine?: string };

/** 用户提交的分镜表 / Markdown 表格走与助手相同的渲染样式 */
export function parseSeedVideoUserMessageDisplay(content: string): SeedVideoUserMessageDisplay {
  const t = content.trim();
  if (!/\|.+\|/.test(t)) return { kind: "text", text: content };

  const blocks = t.split(/\n\n+/);
  if (blocks.length >= 2) {
    const actionLine = blocks[blocks.length - 1]!.trim();
    const markdown = blocks.slice(0, -1).join("\n\n").trim();
    if (
      markdown.includes("|") &&
      !actionLine.includes("|") &&
      actionLine.length > 0 &&
      actionLine.length <= 160
    ) {
      return { kind: "markdown", markdown, actionLine };
    }
  }

  return { kind: "markdown", markdown: t };
}
