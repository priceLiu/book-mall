const PROVIDER_LABEL: Record<string, string> = {
  KIE: "KIE",
  BAILIAN: "百炼",
  DEEPSEEK: "DeepSeek",
  DASHSCOPE: "DashScope",
  HUNYUAN: "混元 3D",
  VOLCENGINE: "火山方舟",
};

const REQUEST_KIND_LABEL: Record<string, string> = {
  CHAT: "对话 / LLM",
  IMAGE: "图像",
  VIDEO: "视频",
  TTS: "语音合成",
  TRYON: "AI 试衣",
  OTHER: "其他",
};

export function formatProviderKindLabel(kind: string): string {
  return PROVIDER_LABEL[kind] ?? kind;
}

export function formatRequestKindLabel(kind: string): string {
  return REQUEST_KIND_LABEL[kind] ?? kind;
}
