import {
  CHARACTER_PRESET_FEMALE_CHOICE,
  CHARACTER_PRESET_MALE_CHOICE,
} from "@/lib/storyboard-character-presets";
import {
  CUSTOM_PARAMS_CHOICE,
  getCategoryChoiceLabels,
  getChoicesForStep,
  hasProductName,
  inferProductNameFromChat,
  isAwaitingCategory,
  isParamCollecting,
  PARAM_STEPS,
  QUICK_GENERATE_CHOICE,
  REGENERATE_PLAN_CHOICE,
  resetParamCollectPatch,
  startCustomParamCollectPatch,
} from "@/lib/storyboard-param-collect";
import {
  buildCustomSceneLlmUserMessage,
  buildScenePresetLlmUserMessage,
  CUSTOM_SCENE_INPUT_CHOICE,
  formatSceneCustomDisplay,
  getScenePresetChoiceLabels,
  isSceneAdjustLlmTrigger,
  isScenePresetChoice,
  resolveScenePresetByKey,
  resolveScenePresetByLabel,
  SCENE_APPLY_AI_CHOICE,
  SCENE_APPLY_CUSTOM_CHOICE,
} from "@/lib/storyboard-scene-presets";
import type { StoryboardDeliverable, StoryboardProject, StoryboardReference } from "@/lib/storyboard-types";
import { extractStoryboardDeliverableFromText, asStoryboardDeliverable } from "@/lib/storyboard-deliverable-parse";
import { isFashionDeliverable } from "@/lib/fashion-types";

export type StoryboardUploadRole = "product" | "character" | "scene";

export type StoryboardSchemePickChoice = {
  id: string;
  label: string;
  title: string;
  description?: string;
  message: string;
  recommended?: boolean;
};

/** meta 未同步时，从聊天记录 / deliverableMarkdown 解析 deliverable */
export function resolveStoryboardDeliverable(
  project: StoryboardProject,
): StoryboardDeliverable | null {
  const fromMeta = asStoryboardDeliverable(project.meta?.deliverable);
  if (fromMeta?.schemes?.length || fromMeta?.analysis) return fromMeta ?? null;

  for (let i = project.chatHistory.length - 1; i >= 0; i--) {
    const msg = project.chatHistory[i];
    if (msg?.role !== "assistant") continue;
    const parsed = extractStoryboardDeliverableFromText(msg.content);
    if (parsed?.schemes?.length || parsed?.analysis) return parsed;
  }

  const cachedMd = project.meta?.deliverableMarkdown?.trim();
  if (cachedMd) {
    const parsed = extractStoryboardDeliverableFromText(cachedMd);
    if (parsed?.schemes?.length || parsed?.analysis) return parsed;
  }

  return fromMeta ?? null;
}

/** 方案已产出（或已选定），进入角色/场景参考与定稿阶段 */
export function isInPostPlanRefWorkflow(project: StoryboardProject): boolean {
  if (project.sheet) return false;
  if (!hasStoryboardProductRef(project)) return false;
  if (!hasStoryboardPlanningContent(project)) return false;
  if (isAwaitingSchemePick(project)) return false;
  return userPickedScheme(project);
}

function userSaid(project: StoryboardProject, texts: string[]): boolean {
  return project.chatHistory.some(
    (m) =>
      m.role === "user" &&
      texts.some((t) => m.content.trim() === t || m.content.includes(t)),
  );
}

export function hasStoryboardProductRef(project: StoryboardProject): boolean {
  return project.references.some((r) => r.role === "product");
}

export function isCustomParamsComplete(project: StoryboardProject): boolean {
  const wf = project.meta?.workflow ?? {};
  if (wf.planMode !== "custom" || wf.paramCollecting) return false;
  const collected = wf.collectedParams ?? {};
  return PARAM_STEPS.every((s) => Boolean(collected[s.key]));
}

export function planModeChosen(project: StoryboardProject): boolean {
  const wf = project.meta?.workflow ?? {};
  if (wf.paramCollecting) return false;
  if (wf.planMode === "quick" || wf.planMode === "default_a") return true;
  if (wf.planMode === "custom" && isCustomParamsComplete(project)) return true;
  return false;
}

export function hasPlanningDeliverable(project: StoryboardProject): boolean {
  const deliverable = resolveStoryboardDeliverable(project);
  return Boolean(deliverable?.analysis || deliverable?.schemes?.length || project.sheet);
}

export function hasStoryboardPlanningContent(project: StoryboardProject): boolean {
  const deliverable = resolveStoryboardDeliverable(project);
  return Boolean(deliverable?.analysis || deliverable?.schemes?.length);
}

/** 已选生成方式但策划 JSON 未入库（LLM 失败或未输出 deliverable） */
export function isAwaitingPlanDeliverable(project: StoryboardProject): boolean {
  if (project.sheet) return false;
  if (isParamCollecting(project)) return false;
  if (isAwaitingPlanMode(project)) return false;
  if (project.meta?.workflow?.replanning) return false;
  if (!planModeChosen(project)) return false;
  return !hasStoryboardPlanningContent(project);
}

/** meta 或聊天记录中已选定方案（避免父级 project 刷新滞后） */
export function userPickedScheme(project: StoryboardProject): boolean {
  const schemes = resolveStoryboardDeliverable(project)?.schemes ?? [];
  if (schemes.length <= 1) return schemes.length === 1;

  if (project.meta?.workflow?.schemePicked === true) return true;

  for (let i = project.chatHistory.length - 1; i >= 0; i--) {
    const msg = project.chatHistory[i];
    if (msg?.role === "user" && parseSchemePickChoice(project, msg.content) != null) {
      return true;
    }
  }
  return false;
}

export function resolveSelectedSchemeIndex(project: StoryboardProject): number {
  if (typeof project.meta?.selectedSchemeIndex === "number") {
    return project.meta.selectedSchemeIndex;
  }
  for (let i = project.chatHistory.length - 1; i >= 0; i--) {
    const msg = project.chatHistory[i];
    if (msg?.role === "user") {
      const idx = parseSchemePickChoice(project, msg.content);
      if (idx != null) return idx;
    }
  }
  return 0;
}

/** 多套方案已生成，等待用户选定（未定稿、无 sheet） */
export function isAwaitingSchemePick(project: StoryboardProject): boolean {
  if (project.sheet) return false;
  const schemes = resolveStoryboardDeliverable(project)?.schemes ?? [];
  if (schemes.length <= 1) return false;
  return !userPickedScheme(project);
}

/** 历史误标 schemePicked（未点选、仍处 planning）时可自动修复 */
export function needsStaleSchemePickReset(project: StoryboardProject): boolean {
  const schemes = resolveStoryboardDeliverable(project)?.schemes ?? [];
  if (schemes.length <= 1 || project.sheet) return false;
  const wf = project.meta?.workflow ?? {};
  if (wf.schemePicked !== true || wf.phase !== "planning") return false;
  return !project.chatHistory.some(
    (m) => m.role === "user" && parseSchemePickChoice(project, m.content) != null,
  );
}

export function schemePickPromptBlock(): { title: string; subtitle: string } {
  return {
    title: "请选择你喜欢的分镜方案，确认后继续上传参考图",
    subtitle: "选择方案（单选）",
  };
}

export function buildSchemePickChoiceCards(
  project: StoryboardProject,
): StoryboardSchemePickChoice[] {
  return buildSchemePickChoicesFromSchemes(
    resolveStoryboardDeliverable(project)?.schemes ?? [],
  );
}

export function buildSchemePickChoicesFromSchemes(
  schemes: Array<{ id?: string; title?: string; summary?: string; strategy?: string }>,
): StoryboardSchemePickChoice[] {
  return schemes.map((scheme, index) => ({
    id: scheme.id || `scheme-${index}`,
    label: scheme.title?.trim() || `方案${index + 1}`,
    title: scheme.title?.trim() || `方案${index + 1}`,
    description: scheme.summary?.trim() || scheme.strategy?.trim() || undefined,
    message: schemePickChoiceLabel(scheme, index),
    recommended: index === 0,
  }));
}

export function schemePickChoiceLabel(
  scheme: { title?: string },
  index: number,
): string {
  const title = scheme.title?.trim() || `方案${index + 1}`;
  return title.startsWith("采用") ? title : `采用${title}`;
}

export function getSchemePickChoices(project: StoryboardProject): string[] {
  return buildSchemePickChoiceCards(project).map((c) => c.message);
}

export function parseSchemePickChoice(
  project: StoryboardProject,
  text: string,
): number | null {
  const schemes = resolveStoryboardDeliverable(project)?.schemes ?? [];
  const t = text.trim();
  if (!t) return null;

  for (let i = 0; i < schemes.length; i++) {
    const label = schemePickChoiceLabel(schemes[i]!, i);
    if (t === label || t === schemes[i]!.title?.trim()) return i;
  }

  const cnMap: Record<string, number> = { 一: 0, 二: 1, 三: 2 };
  const numMap: Record<string, number> = { "1": 0, "2": 1, "3": 2 };
  const cn = t.match(/方案([一二三])/);
  if (cn?.[1] && cnMap[cn[1]!] != null && cnMap[cn[1]!]! < schemes.length) {
    return cnMap[cn[1]!]!;
  }
  const num = t.match(/方案\s*([123])/);
  if (num?.[1] && numMap[num[1]!] != null && numMap[num[1]!]! < schemes.length) {
    return numMap[num[1]!]!;
  }
  return null;
}

export function selectedSchemeForProject(project: StoryboardProject) {
  const schemes = resolveStoryboardDeliverable(project)?.schemes ?? [];
  const idx = resolveSelectedSchemeIndex(project);
  return schemes[idx] ?? schemes[0] ?? null;
}

export function isAwaitingPlanMode(project: StoryboardProject): boolean {
  if (isParamCollecting(project)) return false;
  if (!project.meta?.workflow?.productCategory) return false;
  if (planModeChosen(project)) return false;
  if (hasPlanningDeliverable(project)) return false;
  return hasProductName(project);
}

export function productRefStepDone(project: StoryboardProject): boolean {
  return hasStoryboardProductRef(project);
}

/** 开场：须先上传产品图（策划交付前） */
export function isAwaitingInitialProductRef(project: StoryboardProject): boolean {
  if (hasPlanningDeliverable(project)) return false;
  return !hasStoryboardProductRef(project);
}

/** 产品图已上传，等待输入产品名 */
export function isAwaitingProductNameInput(project: StoryboardProject): boolean {
  if (hasPlanningDeliverable(project)) return false;
  if (!hasStoryboardProductRef(project)) return false;
  return !hasProductName(project);
}

export function characterRefStepDone(project: StoryboardProject): boolean {
  const wf = project.meta?.workflow ?? {};
  return (
    userSaid(project, ["已上传角色图"]) ||
    Boolean(wf.autoGenCharacter) ||
    Boolean(wf.characterPresetKey) ||
    Boolean(wf.skippedCharacter)
  );
}

export function hasSceneReference(project: StoryboardProject): boolean {
  return project.references.some((r) => r.role === "scene" || r.role === "other");
}

export function sceneRefStepDone(project: StoryboardProject): boolean {
  const wf = project.meta?.workflow ?? {};
  if (wf.awaitingSceneApplyMode) return false;
  return (
    userSaid(project, ["已上传场景图", "已上传参考图"]) ||
    Boolean(wf.scenePreset) ||
    Boolean(wf.scenePresetCustom) ||
    Boolean(wf.skippedRefs)
  );
}

export function isAwaitingSceneApplyMode(project: StoryboardProject): boolean {
  if (project.meta?.workflow?.awaitingSceneApplyMode) return true;
  const hist = project.chatHistory;
  for (let i = hist.length - 1; i >= 0; i--) {
    const m = hist[i];
    if (m?.role !== "assistant") continue;
    if (!m.content.includes("请选择应用方式")) continue;
    const after = hist.slice(i + 1);
    const picked = after.some(
      (x) =>
        x.role === "user" &&
        (x.content.trim() === SCENE_APPLY_CUSTOM_CHOICE ||
          x.content.trim() === SCENE_APPLY_AI_CHOICE),
    );
    return !picked;
  }
  return false;
}

const SCENE_STEP_RESERVED_USER_TEXT = new Set([
  "定稿",
  "无需微调",
  "跳过",
  "已上传场景图",
  "已上传参考图",
  CUSTOM_SCENE_INPUT_CHOICE,
  SCENE_APPLY_CUSTOM_CHOICE,
  SCENE_APPLY_AI_CHOICE,
]);

export function isAwaitingCustomSceneInput(project: StoryboardProject): boolean {
  if (project.meta?.workflow?.awaitingCustomSceneInput) return true;
  const hist = project.chatHistory;
  for (let i = hist.length - 1; i >= 0; i--) {
    const m = hist[i];
    if (m?.role !== "assistant") continue;
    if (!m.content.includes("请描述拍摄场景")) continue;
    const after = hist.slice(i + 1);
    const answered = after.some(
      (x) =>
        x.role === "user" &&
        !SCENE_STEP_RESERVED_USER_TEXT.has(x.content.trim()) &&
        !isScenePresetChoice(x.content.trim()) &&
        !isSceneAdjustLlmTrigger(x.content),
    );
    return !answered;
  }
  return false;
}

/** 场景步骤：用户输入应写入 scenePreset，不得走通用 LLM */
export function shouldCaptureSceneDescription(
  project: StoryboardProject,
  text: string,
): boolean {
  const t = text.trim();
  if (!t || t.length > 120) return false;
  if (isSceneAdjustLlmTrigger(t)) return false;
  if (SCENE_STEP_RESERVED_USER_TEXT.has(t)) return false;
  if (isScenePresetChoice(t)) return false;
  if (isAwaitingSceneApplyMode(project)) return false;

  if (isAwaitingCustomSceneInput(project)) return true;

  if (
    isInPostPlanRefWorkflow(project) &&
    characterRefStepDone(project) &&
    !sceneRefStepDone(project)
  ) {
    return true;
  }

  return false;
}

export function getSceneRefStepChoices(project: StoryboardProject): string[] {
  if (hasSceneReference(project)) {
    return ["已上传场景图", "跳过"];
  }
  return [
    ...getScenePresetChoiceLabels(),
    CUSTOM_SCENE_INPUT_CHOICE,
    "已上传场景图",
    "跳过",
  ];
}

export function startCustomSceneInput(): {
  workflowPatch: Record<string, unknown>;
  assistantReply: string;
} {
  return {
    workflowPatch: { awaitingCustomSceneInput: true },
    assistantReply:
      "请描述拍摄场景（环境、光线、道具等，一行即可，如「羽毛球馆更衣室」）：",
  };
}

export function completeCustomSceneInput(
  project: StoryboardProject,
  description: string,
): {
  workflowPatch: Record<string, unknown>;
  assistantReply: string;
} | null {
  const text = description.trim();
  if (!text) return null;
  if (text.startsWith("场景参考已确认") || text.includes("storyboard-deliverable")) {
    return null;
  }
  if (text.length > 120) return null;

  const preset = resolveScenePresetByLabel(text);
  if (preset) {
    return {
      workflowPatch: {
        scenePreset: preset.key,
        scenePresetCustom: undefined,
        awaitingCustomSceneInput: false,
        awaitingSceneApplyMode: true,
        skippedRefs: false,
      },
      assistantReply: `已记录场景：${preset.label}。请选择应用方式：`,
    };
  }

  return {
    workflowPatch: {
      scenePreset: "custom",
      scenePresetCustom: text,
      awaitingCustomSceneInput: false,
      awaitingSceneApplyMode: true,
      skippedRefs: false,
    },
    assistantReply: `已记录场景：${text}。请选择应用方式：`,
  };
}

export function completeScenePresetChoice(
  project: StoryboardProject,
  label: string,
): { workflowPatch: Record<string, unknown>; assistantReply: string } | null {
  const preset = resolveScenePresetByLabel(label);
  if (!preset) return null;
  return {
    workflowPatch: {
      scenePreset: preset.key,
      scenePresetCustom: undefined,
      awaitingSceneApplyMode: true,
      skippedRefs: false,
    },
    assistantReply: `已记录场景：${preset.label}。请选择应用方式：`,
  };
}

export function resolveSceneApplyLlmMessage(project: StoryboardProject): string | null {
  const wf = project.meta?.workflow ?? {};
  const productName = inferProductNameFromChat(project);
  if (wf.scenePreset === "custom" && wf.scenePresetCustom?.trim()) {
    return buildCustomSceneLlmUserMessage(wf.scenePresetCustom, productName);
  }
  const preset = resolveScenePresetByKey(wf.scenePreset);
  if (preset) {
    return buildScenePresetLlmUserMessage(preset, productName);
  }
  return null;
}

export function completeSceneApplyCustom(project: StoryboardProject): {
  workflowPatch: Record<string, unknown>;
  assistantReply: string;
} {
  const label = sceneApplyModePromptLabel(project);
  return {
    workflowPatch: { awaitingSceneApplyMode: false },
    assistantReply: `已按自定义方式记录场景「${label}」，分镜脚本保持原稿。确认无误可回复「定稿」。`,
  };
}

export function sceneApplyModePromptLabel(project: StoryboardProject): string {
  const wf = project.meta?.workflow ?? {};
  if (wf.scenePreset === "custom" && wf.scenePresetCustom) {
    return formatSceneCustomDisplay(wf.scenePresetCustom);
  }
  return resolveScenePresetByKey(wf.scenePreset)?.label ?? "当前场景";
}

export function completeSceneApplyAi(): {
  workflowPatch: Record<string, unknown>;
  assistantReply: string;
} {
  return {
    workflowPatch: { awaitingSceneApplyMode: false },
    assistantReply: "正在根据所选场景微调各镜头画面背景…",
  };
}

/** @deprecated 使用 sceneRefStepDone */
export function otherRefStepDone(project: StoryboardProject): boolean {
  return sceneRefStepDone(project);
}

/** 当前应收参考图的类型（用户点「已上传」前可连续上传多张） */
export function inferCollectUploadRole(project: StoryboardProject): StoryboardUploadRole {
  if (isAwaitingInitialProductRef(project) || isAwaitingProductNameInput(project)) {
    return "product";
  }
  if (isInPostPlanRefWorkflow(project)) {
    if (!characterRefStepDone(project)) return "character";
    if (!sceneRefStepDone(project)) return "scene";
    return "scene";
  }
  if (!productRefStepDone(project)) return "product";
  if (!characterRefStepDone(project)) return "character";
  if (!sceneRefStepDone(project)) return "scene";
  return "scene";
}

/** @deprecated 使用 inferCollectUploadRole */
export function inferNextUploadRole(
  project: StoryboardProject,
): StoryboardReference["role"] {
  return inferCollectUploadRole(project);
}

/** 各镜头分镜图均已生成（与右侧分镜图区一致） */
export function hasAllPanelImages(project: StoryboardProject): boolean {
  const panels = project.sheet?.panels ?? [];
  return panels.length > 0 && panels.every((p) => Boolean(p.imageUrl));
}

/** 分镜图阶段完成：全部镜头有图，或已合成完整分镜 PNG */
export function hasSheetImagesReady(project: StoryboardProject): boolean {
  return hasAllPanelImages(project) || Boolean(project.sheetPngUrl);
}

export function panelVideoCount(project: StoryboardProject): number {
  return project.sheet?.panels.filter((p) => Boolean(p.videoUrl)).length ?? 0;
}

export function resolveAssistantComposerPlaceholder(project: StoryboardProject): string {
  const wf = project.meta?.workflow ?? {};
  if (wf.awaitingCustomSceneInput) {
    return "请描述拍摄场景（环境、光线、道具等）…";
  }
  if (wf.awaitingSceneApplyMode) {
    return "请点击上方按钮选择「自定义」或「AI 生成」…";
  }
  if (wf.paramAwaitingSellpoint) {
    return "请输入产品卖点（品牌、价格、核心卖点等）…";
  }
  if (isParamCollecting(project)) {
    return "请点击上方按钮选择参数…";
  }
  if (isAwaitingInitialProductRef(project)) {
    return "请先在参考图区上传产品图（必填），完成后点击「已上传产品图」…";
  }
  if (isAwaitingProductNameInput(project)) {
    return "请输入产品名（如「蓝牙耳机」「保湿面霜」）…";
  }
  if (isAwaitingCategory(project)) {
    return "请选择产品品类，或点击上方按钮…";
  }
  if (isAwaitingPlanMode(project)) {
    return "请点击上方按钮选择「快速生成」或「自定义参数」…";
  }

  if (isAwaitingSchemePick(project)) {
    return "点选上方方案卡片继续；也可输入补充说明…";
  }

  if (isInPostPlanRefWorkflow(project)) {
    if (!characterRefStepDone(project)) {
      return "请上传角色图、选择预设，或点击「跳过」…";
    }
    if (!sceneRefStepDone(project)) {
      return "请选择场景预设、上传场景图，或点击「跳过」…";
    }
    return "确认方案无误可回复「定稿」；需修改请说明调整点…";
  }

  const hasPlanning = hasStoryboardPlanningContent(project);
  const hasSheet = Boolean(project.sheet);

  if (hasPlanning && !hasSheet) {
    if (!characterRefStepDone(project)) {
      return "请上传角色图、选择预设，或点击「跳过」…";
    }
    if (!sceneRefStepDone(project)) {
      return "请选择场景预设、上传场景图，或点击「跳过」…";
    }
    return "确认方案无误可回复「定稿」；需修改请说明调整点…";
  }

  if (hasSheet && !hasSheetImagesReady(project)) {
    return "方案已定稿：可点击「生成全部分镜图」，或输入微调说明…";
  }
  if (hasSheetImagesReady(project)) {
    return "分镜图已就绪：可生成整图成片或合并分镜视频…";
  }

  if (isAwaitingPlanDeliverable(project)) {
    return "策划方案未完整生成，请点击「重新生成策划」重试…";
  }

  return "点击上方按钮继续，或输入补充说明…";
}

export function inferAssistantChoices(project: StoryboardProject): string[] {
  if (project.meta?.workflow?.replanning) return [];
  if (isAwaitingCustomSceneInput(project)) return [];
  if (isAwaitingSceneApplyMode(project)) {
    return [SCENE_APPLY_CUSTOM_CHOICE, SCENE_APPLY_AI_CHOICE];
  }

  if (isParamCollecting(project)) {
    return getChoicesForStep(project);
  }

  const hasSheet = Boolean(project.sheet);
  const hasPlanning = hasStoryboardPlanningContent(project);
  const imagesReady = hasSheetImagesReady(project);
  const hasVideo = Boolean(project.videoAssetId);

  if (isAwaitingCategory(project)) {
    return getCategoryChoiceLabels();
  }

  if (isAwaitingInitialProductRef(project)) {
    return hasStoryboardProductRef(project) ? ["已上传产品图"] : [];
  }

  if (isAwaitingProductNameInput(project)) {
    return [];
  }

  if (isAwaitingPlanMode(project)) {
    return [QUICK_GENERATE_CHOICE, CUSTOM_PARAMS_CHOICE];
  }

  if (isAwaitingPlanDeliverable(project)) {
    return [REGENERATE_PLAN_CHOICE];
  }

  // 多套方案：由助手区卡片点选，不在气泡内重复展示胶囊按钮
  if (isAwaitingSchemePick(project)) {
    return [];
  }

  // 策划交付后：角色 / 场景 / 定稿（产品图仅开场上传，此处不再检测）
  if (isInPostPlanRefWorkflow(project)) {
    if (!characterRefStepDone(project)) {
      return [
        "已上传角色图",
        CHARACTER_PRESET_FEMALE_CHOICE,
        CHARACTER_PRESET_MALE_CHOICE,
        "是，自动生成角色",
        "跳过",
      ];
    }
    if (!sceneRefStepDone(project)) return getSceneRefStepChoices(project);
    return ["无需微调", "定稿"];
  }

  if (hasSheet && !imagesReady) return ["生成全部分镜图", "重新定方案"];
  if (imagesReady && !hasVideo) {
    const choices = ["生成整图成片"];
    if (panelVideoCount(project) >= 2) choices.push("合并分镜视频");
    return choices;
  }
  return [];
}

/** 助手区点击后打开右侧生图模型选择，不向助手发消息 */
export const STORYBOARD_GENERATE_ALL_IMAGES_CHOICE = "生成全部分镜图";

export function isGenerateAllImagesChoice(text: string): boolean {
  return text === STORYBOARD_GENERATE_ALL_IMAGES_CHOICE || text === "开始生成分镜图";
}

/** 助手区点击后打开右侧视频模型选择（整图成片） */
export const STORYBOARD_GENERATE_FULL_VIDEO_CHOICE = "生成整图成片";

export function isGenerateFullVideoChoice(text: string): boolean {
  return text === STORYBOARD_GENERATE_FULL_VIDEO_CHOICE;
}

/** 助手区点击后直接触发分镜视频合并 */
export const STORYBOARD_MERGE_PANEL_VIDEOS_CHOICE = "合并分镜视频";

export function isMergePanelVideosChoice(text: string): boolean {
  return text === STORYBOARD_MERGE_PANEL_VIDEOS_CHOICE;
}

export function workflowPatchForChoice(
  project: StoryboardProject,
  text: string,
): Record<string, unknown> | null {
  if (text === "跳过") {
    if (!characterRefStepDone(project)) return { skippedCharacter: true };
    if (!sceneRefStepDone(project)) {
      return { skippedRefs: true, scenePreset: undefined, scenePresetCustom: undefined };
    }
  }
  if (text === CHARACTER_PRESET_FEMALE_CHOICE) {
    return { characterPresetKey: "female_ugc", autoGenCharacter: true };
  }
  if (text === CHARACTER_PRESET_MALE_CHOICE) {
    return { characterPresetKey: "male_ugc", autoGenCharacter: true };
  }
  if (text === "是，自动生成角色") return { autoGenCharacter: true };
  if (text === CUSTOM_PARAMS_CHOICE) return startCustomParamCollectPatch(project);
  if (text === "重新定方案") {
    return {
      phase: "planning",
      replanning: true,
      ...resetParamCollectPatch(),
    };
  }
  if (text === "定稿" || text === "无需微调") return { replanning: false, phase: "refs" };
  if (text === "wan2.7-image" || text === "通义万相 2.7") return { imageModelKey: "wan2.7-image" };
  if (text === "wan2.7-image-pro" || text === "通义万相 2.7 Pro")
    return { imageModelKey: "wan2.7-image-pro" };
  if (
    text === "qwen-image-3.0-pro" ||
    text === "千问 Image 3.0 Pro" ||
    text === "千问 image 3.0 pro"
  ) {
    return { imageModelKey: "qwen-image-3.0-pro" };
  }
  if (
    text === "qwen-image-edit" ||
    text === "千问图像编辑" ||
    text === "千问 · 图像编辑"
  ) {
    return { imageModelKey: "qwen-image-edit" };
  }
  if (
    text === "qwen-image-edit-max" ||
    text === "千问图像编辑 Max" ||
    text === "千问 · 图像编辑 Max"
  ) {
    return { imageModelKey: "qwen-image-edit-max" };
  }
  if (
    text === "wan2.6-image" ||
    text === "wan2.6-t2i" ||
    text === "通义万相 2.6"
  ) {
    return { imageModelKey: "wan2.6-image" };
  }
  if (
    text === "kling-3.0-image" ||
    text === "可灵 3.0" ||
    text === "Kling 3.0"
  ) {
    return { imageModelKey: "kling-3.0-image" };
  }
  if (
    text === "nano-banana-pro" ||
    text === "Nano Banana Pro" ||
    text === "nanobanana" ||
    text === "nano banana"
  ) {
    return { imageModelKey: "nano-banana-pro" };
  }
  if (text === "doubao-seedance-2.0") return { videoModelKey: "doubao-seedance-2.0" };
  if (
    text === "bytedance/seedance-2" ||
    text === "seedance-2" ||
    text === "Seedance 2" ||
    text === "Seedance 2 (KIE)"
  ) {
    return { videoModelKey: "bytedance/seedance-2" };
  }
  if (
    text === "kling-3.0/video" ||
    text === "kling 3.0" ||
    text === "可灵 3.0" ||
    text === "Kling 3.0"
  ) {
    return { videoModelKey: "kling-3.0/video" };
  }
  if (
    text === "happyhorse-1.0-r2v" ||
    text === "HappyHorse R2V" ||
    text === "happy horse 1.0 R2v"
  ) {
    return { videoModelKey: "happyhorse-1.0-r2v" };
  }
  if (text === "wan2.7-r2v" || text === "万相 2.7 参考生视频" || text === "万相2.7-r2v") {
    return { videoModelKey: "wan2.7-r2v" };
  }
  if (text === "wan2.6-r2v" || text === "万相 2.6 参考生视频" || text === "wan 2.6-r2v") {
    return { videoModelKey: "wan2.6-r2v" };
  }
  if (
    text === "wan2.6-r2v-flash" ||
    text === "万相 2.6 R2V Flash" ||
    text === "万相 2.6 Flash"
  ) {
    return { videoModelKey: "wan2.6-r2v-flash" };
  }
  return null;
}
