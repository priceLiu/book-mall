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

/** 在列表中优先选用已绑定凭证的模型；preferred 未绑定时有其它可用项则回退 */
export function pickBoundStoryboardModelKey(
  models: StoryboardGatewayModel[],
  preferred: string,
): string {
  if (models.length === 0) return preferred;
  const preferredModel = models.find((m) => m.modelKey === preferred);
  if (preferredModel?.credentialBound || preferredModel?.platformOffering) {
    return preferred;
  }
  const bound = models.find((m) => m.credentialBound || m.platformOffering);
  if (bound) return bound.modelKey;
  if (preferredModel) return preferred;
  return models[0]!.modelKey;
}

export function hasBoundStoryboardModel(models: StoryboardGatewayModel[]): boolean {
  return models.some((m) => m.credentialBound);
}
