import type { BrandViChatMessage, BrandViProject, BrandViStepId } from "@/lib/brand-vi-types";
import {
  BRAND_VI_STYLE_PRESETS,
  brandViStyleChoiceMessage,
  parseBrandViStyleChoiceMessage,
  type BrandViStylePresetId,
} from "@/lib/brand-vi-style-presets";
import {
  assistantChoices,
  brandViStep,
  BRAND_VI_STEPS,
  isStepReady,
  stepIdFromChoice,
  stepState,
} from "@/lib/brand-vi-workflow";
import type { SeedVideoAssistantChoice } from "@/lib/seed-video-workflow";

export type BrandViHistoricalChoiceBlock = {
  title: string;
  selectedMessage: string;
  cards: SeedVideoAssistantChoice[];
};

function slugId(text: string): string {
  return text.replace(/\s+/g, "-").slice(0, 48);
}

export function buildBrandViStyleChoices(): SeedVideoAssistantChoice[] {
  return BRAND_VI_STYLE_PRESETS.map((p) => ({
    id: p.id,
    label: brandViStyleChoiceMessage(p.id),
    title: p.title,
    message: brandViStyleChoiceMessage(p.id),
    description: p.description,
    recommended: p.recommended,
  }));
}

export function buildBrandViStepChoices(
  project: BrandViProject,
  currentStepId: BrandViStepId,
): SeedVideoAssistantChoice[] {
  const labels = assistantChoices(project, currentStepId);
  const meta = brandViStep(currentStepId);
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

export function buildBrandViHistoricalChoiceBlock(
  project: BrandViProject,
  userMessage: string,
  messageIndex: number,
): BrandViHistoricalChoiceBlock | null {
  const trimmed = userMessage.trim();
  const styleId = parseBrandViStyleChoiceMessage(trimmed);
  if (styleId) {
    return {
      title: "视觉风格",
      selectedMessage: trimmed,
      cards: buildBrandViStyleChoices(),
    };
  }
  const stepId = stepIdFromChoice(trimmed);
  if (stepId) {
    const prior = project.chatHistory.slice(0, messageIndex);
    const pseudo: BrandViProject = { ...project, chatHistory: prior };
    const targetStep = stepId;
    return {
      title: `第 ${brandViStep(targetStep).no} 步操作`,
      selectedMessage: trimmed,
      cards: buildBrandViStepChoices(pseudo, targetStep),
    };
  }
  for (const step of BRAND_VI_STEPS) {
    const choices = buildBrandViStepChoices(project, step.id).map((c) => c.message);
    if (choices.includes(trimmed)) {
      return {
        title: `第 ${step.no} 步操作`,
        selectedMessage: trimmed,
        cards: buildBrandViStepChoices(project, step.id),
      };
    }
  }
  return null;
}

export function resolveBrandViStylePatchFromChoice(
  message: string,
): Partial<BrandViProject["settings"]> | null {
  const id = parseBrandViStyleChoiceMessage(message);
  if (!id) return null;
  return { stylePresetId: id };
}

export function isBrandViStyleChoice(message: string): boolean {
  return parseBrandViStyleChoiceMessage(message) != null;
}

export function currentBrandViStyleMessage(project: BrandViProject): string {
  const id = (project.settings?.stylePresetId ?? "popmart3d") as BrandViStylePresetId;
  return brandViStyleChoiceMessage(id);
}

export function brandViStyleChosenInHistory(messages: BrandViChatMessage[]): boolean {
  return messages.some((m) => m.role === "user" && isBrandViStyleChoice(m.content));
}

export function shouldHideLiveBrandViStepChoices(
  project: BrandViProject,
  messages: BrandViChatMessage[],
  currentStepId: BrandViStepId,
): boolean {
  if (stepState(project, currentStepId).status === "generating") return true;

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const trimmed = m.content.trim();
    const block = buildBrandViHistoricalChoiceBlock(project, trimmed, i);
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
