import type { HandCraftChatMessage, HandCraftProject, HandCraftStepId } from "@/lib/hand-craft-types";
import {
  HAND_CRAFT_STYLE_PRESETS,
  handCraftStyleChoiceMessage,
  parseHandCraftStyleChoiceMessage,
  type HandCraftStylePresetId,
} from "@/lib/hand-craft-style-presets";
import {
  assistantChoices,
  handCraftStep,
  HAND_CRAFT_STEPS,
  isStepReady,
  stepIdFromChoice,
  stepState,
} from "@/lib/hand-craft-workflow";
import type { SeedVideoAssistantChoice } from "@/lib/seed-video-workflow";

export type HandCraftHistoricalChoiceBlock = {
  title: string;
  selectedMessage: string;
  cards: SeedVideoAssistantChoice[];
};

function slugId(text: string): string {
  return text.replace(/\s+/g, "-").slice(0, 48);
}

export function buildHandCraftStyleChoices(): SeedVideoAssistantChoice[] {
  return HAND_CRAFT_STYLE_PRESETS.map((p) => ({
    id: p.id,
    label: handCraftStyleChoiceMessage(p.id),
    title: p.title,
    message: handCraftStyleChoiceMessage(p.id),
    description: p.description,
    recommended: p.recommended,
  }));
}

export function buildHandCraftStepChoices(
  project: HandCraftProject,
  currentStepId: HandCraftStepId,
): SeedVideoAssistantChoice[] {
  const labels = assistantChoices(project, currentStepId);
  const meta = handCraftStep(currentStepId);
  return labels.map((message, i) => {
    const isConfirm = message.startsWith("确认生成") || message.startsWith("确认拼版");
    return {
      id: slugId(message),
      label: message,
      title: message,
      message,
      description: isConfirm
        ? meta.kind === "compose"
          ? "在工作区排版并抓图上传"
          : `调用生图模型，共 ${meta.count} 张，以定稿主形象为参考`
        : message.startsWith("微调")
          ? "助手输出槽位说明表，同步到中间工作区"
          : "切换当前步骤并说明本步产出",
      recommended: i === 0,
    };
  });
}

export function buildHandCraftHistoricalChoiceBlock(
  project: HandCraftProject,
  userMessage: string,
  messageIndex: number,
): HandCraftHistoricalChoiceBlock | null {
  const trimmed = userMessage.trim();
  const styleId = parseHandCraftStyleChoiceMessage(trimmed);
  if (styleId) {
    return {
      title: "视觉风格",
      selectedMessage: trimmed,
      cards: buildHandCraftStyleChoices(),
    };
  }
  const stepId = stepIdFromChoice(trimmed);
  if (stepId) {
    const prior = project.chatHistory.slice(0, messageIndex);
    const pseudo: HandCraftProject = { ...project, chatHistory: prior };
    const targetStep = stepId;
    return {
      title: `第 ${handCraftStep(targetStep).no} 步操作`,
      selectedMessage: trimmed,
      cards: buildHandCraftStepChoices(pseudo, targetStep),
    };
  }
  for (const step of HAND_CRAFT_STEPS) {
    const choices = buildHandCraftStepChoices(project, step.id).map((c) => c.message);
    if (choices.includes(trimmed)) {
      return {
        title: `第 ${step.no} 步操作`,
        selectedMessage: trimmed,
        cards: buildHandCraftStepChoices(project, step.id),
      };
    }
  }
  return null;
}

export function resolveHandCraftStylePatchFromChoice(
  message: string,
): Partial<HandCraftProject["settings"]> | null {
  const id = parseHandCraftStyleChoiceMessage(message);
  if (!id) return null;
  return { stylePresetId: id };
}

export function isHandCraftStyleChoice(message: string): boolean {
  return parseHandCraftStyleChoiceMessage(message) != null;
}

export function currentHandCraftStyleMessage(project: HandCraftProject): string {
  const id = (project.settings?.stylePresetId ?? "popmart3d") as HandCraftStylePresetId;
  return handCraftStyleChoiceMessage(id);
}

export function handCraftStyleChosenInHistory(messages: HandCraftChatMessage[]): boolean {
  return messages.some((m) => m.role === "user" && isHandCraftStyleChoice(m.content));
}

/** 已点「确认生成/拼版本步」且尚未出齐时，不再在底部重复展示同一套步骤卡片 */
export function shouldHideLiveHandCraftStepChoices(
  project: HandCraftProject,
  messages: HandCraftChatMessage[],
  currentStepId: HandCraftStepId,
): boolean {
  if (stepState(project, currentStepId).status === "generating") return true;

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const trimmed = m.content.trim();
    const block = buildHandCraftHistoricalChoiceBlock(project, trimmed, i);
    if (!block?.title.includes("步操作")) return false;

    const targetStep = stepIdFromChoice(trimmed) ?? currentStepId;
    if (targetStep !== currentStepId) return false;

    if (trimmed.startsWith("确认生成") || trimmed.startsWith("确认拼版")) {
      return !isStepReady(project, currentStepId);
    }
    return false;
  }
  return false;
}
