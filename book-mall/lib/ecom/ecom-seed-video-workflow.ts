import { parseMentionedImageIndices } from "@/lib/ecom/ecom-seed-video-mention";
import { hasStructuredDirectPlan, hasStructuredFormalShots } from "@/lib/ecom/ecom-seed-video-structured";

export const ECOM_SEED_VIDEO_SCRIPT_CHOICES = [
  "脚本一：氛围感切入‑不费力的高级",
  "脚本二：痛点切入‑梨形身材天菜",
  "脚本三：场景切入‑度假出片指南",
] as const;

export const ECOM_SEED_VIDEO_MODE_CHOICES = [
  "方案①：直接连贯生成视频",
  "方案②：按精细成片流程制作",
] as const;

export const ECOM_SEED_VIDEO_STYLE_CHOICES = [
  "A方案：甜美种草风（小红书）",
  "B方案：干练安利风（抖音带货）",
] as const;

const ALL_CHOICE_TEXTS = new Set<string>([
  ...ECOM_SEED_VIDEO_SCRIPT_CHOICES,
  ...ECOM_SEED_VIDEO_MODE_CHOICES,
  ...ECOM_SEED_VIDEO_STYLE_CHOICES,
]);

/** 点选/编号回复，不应再附带素材图送 Vision */
export function isSeedVideoChoiceMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^全部生成/.test(t)) return true;
  if (ALL_CHOICE_TEXTS.has(t)) return true;
  if (/^我选择成片风格[①②③123]/.test(t)) return true;
  if (/^选成片风格[①②③123]/.test(t)) return true;
  if (/^重新生成/.test(t)) return true;
  if (/^修改分镜时长/.test(t)) return true;
  if (/^替换 BGM/.test(t)) return true;
  if (/^确认分镜执行表|^确认逐镜参数表|^确认成片参数/.test(t)) return true;
  if (/^我选择方案[①②③123][：:]/i.test(t)) return true;
  if (/^(?:选|我要)方案\s*[ABCabc]/.test(t)) return true;
  if (/^选[①②③123]$/.test(t)) return true;
  if (/^【?[123]】?$/.test(t)) return true;
  if (/^方案[①②③123ABCabc]$/.test(t)) return true;
  if (/^[AaBbCc]$/.test(t)) return true;
  return false;
}

/** 仅首条策划或显式 @ 引用时送图；点选后续步骤不再重复送图 */
export function shouldAttachSeedVideoChatImages(
  userText: string,
  priorUserMessageCount: number,
): boolean {
  if (isSeedVideoChoiceMessage(userText)) return false;
  if (parseMentionedImageIndices(userText).length > 0) return true;
  if (/@图片/.test(userText)) return true;
  return priorUserMessageCount === 0;
}

export const ECOM_SEED_VIDEO_FINAL_SHOTS_CONFIRM_MESSAGE =
  "确认逐镜参数表，同步到中间工作区";

export const ECOM_SEED_VIDEO_DIRECT_PLAN_CONFIRM_MESSAGE =
  "确认成片参数，同步到中间工作区";

export function isFinalShotsConfirmChoice(text: string): boolean {
  const t = text.trim();
  return (
    t === ECOM_SEED_VIDEO_FINAL_SHOTS_CONFIRM_MESSAGE || /^确认逐镜参数表/.test(t)
  );
}

export function isDirectPlanConfirmChoice(text: string): boolean {
  const t = text.trim();
  return (
    t === ECOM_SEED_VIDEO_DIRECT_PLAN_CONFIRM_MESSAGE || /^确认成片参数/.test(t)
  );
}

function isDirectPlanAssistantMarkdown(text: string): boolean {
  if (/正式脚本|请确认逐镜参数表|分镜执行表|视频分镜执行表/.test(text)) return false;
  if (/直接连贯成片参数|请确认成片参数/.test(text)) return true;
  if (/配置项/.test(text) && /参数详情/.test(text) && /口播/.test(text)) return true;
  if (/镜号/.test(text) && /画面设计/.test(text) && /参考素材/.test(text) && /口播/.test(text)) {
    return true;
  }
  if (/全局\s*AI\s*生成提示词|全局\s*AI\s*提示词/.test(text)) return true;
  if (/全局.*(?:AI\s*)?(?:生成)?(?:视频)?提示词/.test(text) && /口播/.test(text)) {
    return true;
  }
  return hasStructuredDirectPlan(text);
}

export function isSeedVideoScriptProposalMarkdown(text: string): boolean {
  if (/正式脚本|请确认逐镜参数表|分镜执行表|视频分镜执行表|运镜参数|逐镜参数表/.test(text)) {
    return false;
  }
  if (/请选择.*脚本|请选择脚本|请选择你喜欢的脚本/.test(text)) return true;
  if (/脚本一/.test(text) && /脚本二/.test(text)) return true;
  if (/脚本方案/.test(text) && /[②③2-9]/.test(text)) return true;
  const schemeHeads = text.match(/脚本方案\s*[①②③123ABCabc]/g);
  if (schemeHeads && schemeHeads.length >= 2) return true;
  if (/核心逻辑/.test(text) && /\|/.test(text) && /口播/.test(text)) return true;
  if (
    /方案\s*[ABCabc]/.test(text) &&
    /\|/.test(text) &&
    /分镜|口播|镜号|画面描述/.test(text) &&
    !/AI视频生成提示词|AI提示词|正式脚本/.test(text)
  ) {
    return true;
  }
  return false;
}

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
  if (!/正式脚本|请确认逐镜参数表/.test(text) && !hasPromptCol) return false;
  if (hasPromptCol && hasSceneCol) return true;
  if (/口播/.test(text) && hasSceneCol && /运镜|画面描述|镜头描述/.test(text)) return true;
  if (/素材映射/.test(text) && hasPromptCol) return true;
  return false;
}

export function findPlanMarkdownForSync(project: {
  chatHistory: Array<{ role: string; content: string }>;
  meta?: { lastAssistantRaw?: unknown } | null;
}): string {
  const fromMeta =
    typeof project.meta?.lastAssistantRaw === "string"
      ? project.meta.lastAssistantRaw.trim()
      : "";
  if (
    fromMeta &&
    !isSeedVideoScriptProposalMarkdown(fromMeta) &&
    hasSeedVideoShotsTableMarkdown(fromMeta)
  ) {
    return fromMeta;
  }
  if (fromMeta && isDirectPlanAssistantMarkdown(fromMeta)) return fromMeta;
  if (fromMeta && hasStructuredDirectPlan(fromMeta)) return fromMeta;
  if (fromMeta && hasStructuredFormalShots(fromMeta)) return fromMeta;

  for (const m of [...project.chatHistory].reverse()) {
    const t = m.content.trim();
    if (isSeedVideoScriptProposalMarkdown(t)) continue;
    if (hasSeedVideoShotsTableMarkdown(t)) return t;
    if (isDirectPlanAssistantMarkdown(t)) return t;
    if (hasStructuredDirectPlan(t)) return t;
    if (hasStructuredFormalShots(t)) return t;
  }
  return fromMeta && !isSeedVideoScriptProposalMarkdown(fromMeta) ? fromMeta : "";
}

export function parseSeedVideoProductionModeFromChoice(
  text: string,
): "direct" | "fine" | null {
  const t = text.trim();
  if ((ECOM_SEED_VIDEO_MODE_CHOICES as readonly string[]).includes(t)) {
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
  if ((ECOM_SEED_VIDEO_SCRIPT_CHOICES as readonly string[]).includes(t)) {
    if (t.startsWith("脚本一")) return "script-1";
    if (t.startsWith("脚本二")) return "script-2";
    return "script-3";
  }
  return null;
}

function isSeedVideoScriptChoiceMessage(text: string): boolean {
  return parseSeedVideoScriptIdFromChoice(text) != null;
}

function isSeedVideoModeChoiceMessage(text: string): boolean {
  return parseSeedVideoProductionModeFromChoice(text) != null;
}

function isSeedVideoStyleChoiceMessage(text: string): boolean {
  const t = text.trim();
  if ((ECOM_SEED_VIDEO_STYLE_CHOICES as readonly string[]).includes(t)) return true;
  if (/^我选择成片风格[①②③123]/.test(t)) return true;
  if (/^A方案：/.test(t)) return true;
  if (/^B方案：/.test(t)) return true;
  return false;
}

function userPickedScriptFromProject(project: {
  chatHistory: Array<{ role: string; content: string }>;
  meta?: { workflow?: { selectedScriptId?: string } } | null;
}): boolean {
  if (project.meta?.workflow?.selectedScriptId) return true;
  return project.chatHistory.some(
    (m) => m.role === "user" && isSeedVideoScriptChoiceMessage(m.content),
  );
}

function userPickedModeFromProject(project: {
  chatHistory: Array<{ role: string; content: string }>;
  meta?: { workflow?: { productionMode?: string } } | null;
}): boolean {
  if (project.meta?.workflow?.productionMode) return true;
  return project.chatHistory.some(
    (m) => m.role === "user" && isSeedVideoModeChoiceMessage(m.content),
  );
}

function userPickedFineModeFromProject(project: {
  chatHistory: Array<{ role: string; content: string }>;
  meta?: { workflow?: { productionMode?: string } } | null;
}): boolean {
  if (project.meta?.workflow?.productionMode === "fine") return true;
  return project.chatHistory.some(
    (m) =>
      m.role === "user" &&
      parseSeedVideoProductionModeFromChoice(m.content) === "fine",
  );
}

function userPickedStyleFromProject(project: {
  chatHistory: Array<{ role: string; content: string }>;
  meta?: { workflow?: { stylePreset?: string } } | null;
}): boolean {
  if (project.meta?.workflow?.stylePreset) return true;
  if (!userPickedFineModeFromProject(project)) return false;
  return project.chatHistory.some(
    (m) => m.role === "user" && isSeedVideoStyleChoiceMessage(m.content),
  );
}

/** 中间工作区 / plan.shots 同步门禁 */
export function isSeedVideoProductionWorkspaceReady(project: {
  chatHistory: Array<{ role: string; content: string }>;
  meta?: {
    workflow?: {
      selectedScriptId?: string;
      productionMode?: string;
      stylePreset?: string;
    };
  } | null;
}): boolean {
  if (!userPickedScriptFromProject(project)) return false;
  if (!userPickedModeFromProject(project)) return false;
  if (userPickedFineModeFromProject(project) && !userPickedStyleFromProject(project)) {
    return false;
  }
  return true;
}

export function buildSeedVideoWorkflowContext(opts: {
  chatHistory: Array<{ role: string; content: string }>;
  meta?: {
    workflow?: {
      selectedScriptId?: string;
      productionMode?: string;
      stylePreset?: string;
    };
  } | null;
}): string {
  const workflow = opts.meta?.workflow ?? {};
  let scriptDone = Boolean(workflow.selectedScriptId);
  let modeDone = Boolean(workflow.productionMode);
  let styleDone = Boolean(workflow.stylePreset);

  for (const m of opts.chatHistory) {
    if (m.role !== "user") continue;
    if (isSeedVideoScriptChoiceMessage(m.content)) scriptDone = true;
    if (isSeedVideoModeChoiceMessage(m.content)) modeDone = true;
    if (/^A方案：|^B方案：|^我选择成片风格[①②③123]/.test(m.content.trim())) {
      styleDone = true;
    }
  }

  const lines = ["## 当前策划进度（只推进下一步，禁止回退重复已完成的步骤）"];
  lines.push(scriptDone ? "- 脚本方向：已选" : "- 脚本方向：未选");
  lines.push(
    modeDone
      ? `- 制作模式：已选（${workflow.productionMode === "fine" ? "方案②精细成片" : "方案①直接连贯"}）`
      : "- 制作模式：未选",
  );
  if (modeDone && workflow.productionMode === "fine") {
    lines.push(styleDone ? "- 成片风格：已选" : "- 成片风格：未选");
  }

  if (!scriptDone) {
    lines.push(
      "下一步：输出素材解析 Markdown + 三套脚本 Markdown（## 脚本一/二/三：{title} + 分镜表），结尾「请选择脚本：」；**必须**在回复最末尾追加 ```seed-video JSON（step=scripts, action=await_script_choice, materialAnalysis + scripts 恰好 3 项）**；禁止输出制作模式。",
    );
  } else if (!modeDone) {
    lines.push(
      "下一步：Markdown 结尾「请选择视频制作模式：」+ ```seed-video JSON（step=mode, action=await_mode_choice, modeOptions 恰好 2 项：direct/fine）**；禁止再次输出脚本。",
    );
  } else if (workflow.productionMode === "fine" && !styleDone) {
    const scriptLabel = formatSelectedScriptLabel(workflow.selectedScriptId as string | undefined);
    lines.push(
      `下一步（Step4）：资深广告导演口吻 + A/B 成片风格；Markdown 结尾「请选择成片风格：」+ \`\`\`seed-video JSON（step=style, action=await_style_choice, styleOptions 恰好 2 项）**；基于${scriptLabel}；禁止跳步。`,
    );
  } else if (workflow.productionMode === "direct") {
    lines.push(
      "下一步：Markdown「直接连贯成片参数」+ ```seed-video JSON（step=directPlan, action=await_direct_plan_confirm, directPlan.shotSequence + directPlan.configTable 七键）**；结尾「请确认成片参数：」。",
    );
  } else {
    lines.push(
      "下一步：Markdown「正式脚本」+ ```seed-video JSON（step=formalShots, action=await_formal_shots_confirm, shots + configTable）**；结尾「请确认逐镜参数表：」。",
    );
  }

  lines.push("- **硬性**：每条回复末尾必须有 ```seed-video 围栏 JSON；系统只解析 JSON，不解析 Markdown 表格结构。");

  if (modeDone) {
    lines.push("- **硬性**：用户已选制作模式，禁止再次输出「请选择视频制作模式」。");
  }
  if (scriptDone) {
    lines.push("- **硬性**：用户已选脚本，禁止再次输出三套脚本或「请选择脚本」。");
  }
  if (modeDone && workflow.productionMode === "fine" && !styleDone) {
    lines.push("- **硬性**：用户已选方案②精细成片，本步只输出成片风格 A/B，禁止跳过分镜前的风格步骤。");
  }

  return lines.join("\n");
}

function formatSelectedScriptLabel(scriptId: string | undefined): string {
  if (scriptId === "script-1") return "脚本一「氛围感切入 — 不费力的高级」";
  if (scriptId === "script-2") return "脚本二「痛点切入 — 梨形身材天菜」";
  if (scriptId === "script-3") return "脚本三「场景切入 — 度假出片指南」";
  return "已选脚本";
}

export function mergeSeedVideoWorkflowFromUserChoice(
  prev: Record<string, unknown> | undefined,
  userText: string,
): Record<string, unknown> {
  const next = { ...(prev ?? {}) };
  const mode = parseSeedVideoProductionModeFromChoice(userText);
  if (mode) {
    next.productionMode = mode;
    next.phase = mode === "fine" ? "style" : "production";
    return next;
  }
  const scriptId = parseSeedVideoScriptIdFromChoice(userText);
  if (scriptId) next.selectedScriptId = scriptId;
  if (/^A方案：|^我选择成片风格[①1]/.test(userText.trim())) {
    next.stylePreset = "sweet-xhs";
    next.phase = "storyboard";
  }
  if (/^B方案：|^我选择成片风格[②2]/.test(userText.trim())) {
    next.stylePreset = "sharp-douyin";
    next.phase = "storyboard";
  }
  return next;
}
