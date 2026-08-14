import type { SeedVideoChatMessage, SeedVideoProject, SeedVideoWorkflowPhase } from "@/lib/seed-video-types";

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

function lastAssistant(project: SeedVideoProject): string | null {
  const last = [...project.chatHistory].reverse().find((m) => m.role === "assistant");
  return last?.content?.trim() ?? null;
}

export function inferWorkflowPhase(project: SeedVideoProject): SeedVideoWorkflowPhase {
  const metaPhase = project.meta?.workflow?.phase;
  if (metaPhase) return metaPhase;
  if ((project.plan?.shots?.length ?? 0) > 0) return "shots";
  if (project.meta?.workflow?.productionMode === "direct") return "production";
  if (project.references.length === 0) return "material";
  if (project.chatHistory.length === 0) return "material";
  return "scripts";
}

export function inferAssistantChoices(project: SeedVideoProject): string[] {
  const text = lastAssistant(project);
  if (!text) return [];

  if (/请选择你想要使用的脚本/.test(text)) return [...SCRIPT_CHOICES];
  if (/请选择视频制作模式/.test(text)) return [...MODE_CHOICES];
  if (/请选择成片风格/.test(text)) return [...STYLE_CHOICES];

  return [];
}

export function choicePrompt(project: SeedVideoProject): string {
  const text = lastAssistant(project) ?? "";
  if (/请选择你想要使用的脚本/.test(text)) return "请选择脚本：";
  if (/请选择视频制作模式/.test(text)) return "请选择制作模式：";
  if (/请选择成片风格/.test(text)) return "请选择成片风格：";
  return "请选择：";
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
  return project.meta?.workflow?.productionMode === "direct";
}

export function filterVideoModelsForMode(
  modelKeys: string[],
  direct: boolean,
): string[] {
  const wan30 = "wan3.0-video";
  if (direct) {
    return modelKeys.filter((k) => k === wan30 || k.includes("seedance") || k.includes("t2v"));
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

export function buildUserMessageWithChoice(
  history: SeedVideoChatMessage[],
  choice: string,
): SeedVideoChatMessage[] {
  return [
    ...history,
    {
      id: `user-${Date.now()}`,
      role: "user",
      content: choice,
      createdAt: new Date().toISOString(),
    },
  ];
}
