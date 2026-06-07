import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const PROVIDER_LABELS: Record<string, string> = {
  DASHSCOPE: "通义 DashScope",
  BAILIAN: "百炼",
  KIE: "KIE",
  DEEPSEEK: "DeepSeek",
  VOLCENGINE: "火山方舟",
};

export function storyboardProviderLabel(kind: string): string {
  return PROVIDER_LABELS[kind] ?? kind;
}

/** 在列表中优先选用已绑定凭证的模型 */
export function pickBoundStoryboardModelKey(
  models: StoryboardGatewayModel[],
  preferred: string,
): string {
  if (models.some((m) => m.modelKey === preferred && m.credentialBound)) {
    return preferred;
  }
  return models.find((m) => m.credentialBound)?.modelKey ?? preferred;
}

export function hasBoundStoryboardModel(models: StoryboardGatewayModel[]): boolean {
  return models.some((m) => m.credentialBound);
}
