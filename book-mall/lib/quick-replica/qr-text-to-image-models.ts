export type QrTextToImageParamProfile =
  | "nano_pro"
  | "grok_t2i"
  | "flux2"
  | "seedream"
  | "gpt_image_2"
  | "gpt_image_1"
  | "qwen_t2i";

export type QrTextToImageModelDef = {
  modelKey: string;
  label: string;
  subtitle: string;
  maxRefImages: number;
  paramProfile: QrTextToImageParamProfile;
  defaultMode?: string;
};

export const QR_TEXT_TO_IMAGE_MODELS: QrTextToImageModelDef[] = [
  {
    modelKey: "lib-nano-pro",
    label: "Nano Banana Pro",
    subtitle: "高质量文/图生图",
    maxRefImages: 8,
    paramProfile: "nano_pro",
  },
  {
    modelKey: "grok-imagine/text-to-image",
    label: "Grok Imagine",
    subtitle: "文生图",
    maxRefImages: 0,
    paramProfile: "grok_t2i",
  },
  {
    modelKey: "flux-2-pro",
    label: "Flux 2 Pro",
    subtitle: "文/图生图",
    maxRefImages: 4,
    paramProfile: "flux2",
  },
  {
    modelKey: "seedream-5-lite",
    label: "Seedream 5 Lite",
    subtitle: "文/图生图",
    maxRefImages: 4,
    paramProfile: "seedream",
    defaultMode: "basic",
  },
  {
    modelKey: "seedream-4.5",
    label: "Seedream 4.5",
    subtitle: "文/图生图",
    maxRefImages: 4,
    paramProfile: "seedream",
    defaultMode: "basic",
  },
  {
    modelKey: "gpt-image-2",
    label: "GPT Image 2",
    subtitle: "文/图生图",
    maxRefImages: 4,
    paramProfile: "gpt_image_2",
  },
  {
    modelKey: "gpt-image-1",
    label: "GPT Image 1.5",
    subtitle: "文/图生图",
    maxRefImages: 4,
    paramProfile: "gpt_image_1",
    defaultMode: "medium",
  },
  {
    modelKey: "qwen-text-to-image",
    label: "Qwen 文生图",
    subtitle: "文/图生图",
    maxRefImages: 1,
    paramProfile: "qwen_t2i",
  },
];

export const QR_DEFAULT_TEXT_TO_IMAGE_MODEL_KEY = "lib-nano-pro";

/** Gateway 路由 / KIE createTask 使用的 modelKey */
export function resolveQrTextToImageGatewayModelKey(modelKey: string): string {
  const key = modelKey.trim();
  if (key === "lib-nano-pro") return "nano-banana-pro";
  return key;
}

export function getQrTextToImageModelDef(modelKey: string): QrTextToImageModelDef {
  return (
    QR_TEXT_TO_IMAGE_MODELS.find((m) => m.modelKey === modelKey.trim()) ??
    QR_TEXT_TO_IMAGE_MODELS[0]!
  );
}

export function resolveTextToImageReferenceImageUrls(args: {
  sceneImageUrls: string[];
  targetImageUrl: string;
}): string[] {
  const fromScene = args.sceneImageUrls.map((u) => u.trim()).filter(Boolean);
  if (fromScene.length) return fromScene;
  const target = args.targetImageUrl.trim();
  return target ? [target] : [];
}

export function validateTextToImageDraft(args: {
  modelKey: string;
  prompt: string;
  sceneImageUrls: string[];
  targetImageUrl: string;
}): string | null {
  const prompt = args.prompt.trim();
  if (!prompt) return "请填写提示词";
  const meta = getQrTextToImageModelDef(args.modelKey);
  const refs = resolveTextToImageReferenceImageUrls(args);
  if (meta.maxRefImages === 0 && refs.length > 0) {
    return "当前模型不支持参考图，请移除参考图";
  }
  if (refs.length > meta.maxRefImages) {
    return `参考图最多 ${meta.maxRefImages} 张`;
  }
  return null;
}
