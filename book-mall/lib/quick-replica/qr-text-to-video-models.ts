import {
  isHappyHorseR2vModel,
  maxHappyHorsePromptImageIndex,
  resolveMotionSyncReferenceImageUrls,
} from "@/lib/quick-replica/qr-motion-sync-models";

export type QrTextToVideoParamProfile =
  | "grok_i2v"
  | "kling_turbo"
  | "kling30"
  | "happyhorse_r2v"
  | "wan_t2v"
  | "seedance20";

export type QrTextToVideoModelDef = {
  modelKey: string;
  label: string;
  subtitle: string;
  maxRefImages: number;
  paramProfile: QrTextToVideoParamProfile;
  usesImageTokens?: boolean;
  supportsSound?: boolean;
  defaultMode?: string;
};

export const QR_TEXT_TO_VIDEO_MODELS: QrTextToVideoModelDef[] = [
  {
    modelKey: "doubao-seedance-2.0",
    label: "Seedance 2.0",
    subtitle: "火山方舟 · 文/图生视频",
    maxRefImages: 8,
    paramProfile: "seedance20",
    supportsSound: true,
  },
  {
    modelKey: "grok-imagine/image-to-video",
    label: "Grok Imagine",
    subtitle: "图/文生视频",
    maxRefImages: 7,
    paramProfile: "grok_i2v",
    defaultMode: "normal",
  },
  {
    modelKey: "kling/v3-turbo-text-to-video",
    label: "Kling 3.0 Turbo",
    subtitle: "文生视频",
    maxRefImages: 0,
    paramProfile: "kling_turbo",
  },
  {
    modelKey: "kling-3.0/video",
    label: "Kling 3.0",
    subtitle: "图/文生视频",
    maxRefImages: 4,
    paramProfile: "kling30",
    defaultMode: "pro",
    supportsSound: true,
  },
  {
    modelKey: "happyhorse-1-1/reference-to-video",
    label: "HappyHorse 1.1",
    subtitle: "参考图生视频",
    maxRefImages: 9,
    paramProfile: "happyhorse_r2v",
    usesImageTokens: true,
  },
  {
    modelKey: "wan/2-7-text-to-video",
    label: "Wan 2.7",
    subtitle: "文生视频",
    maxRefImages: 0,
    paramProfile: "wan_t2v",
  },
];

export const QR_DEFAULT_TEXT_TO_VIDEO_MODEL_KEY = "grok-imagine/image-to-video";

export function getQrTextToVideoModelDef(modelKey: string): QrTextToVideoModelDef {
  return (
    QR_TEXT_TO_VIDEO_MODELS.find((m) => m.modelKey === modelKey.trim()) ??
    QR_TEXT_TO_VIDEO_MODELS[0]!
  );
}

export function resolveTextToVideoReferenceImageUrls(args: {
  sceneImageUrls: string[];
  targetImageUrl: string;
}): string[] {
  return resolveMotionSyncReferenceImageUrls(args);
}

export function validateTextToVideoDraft(args: {
  modelKey: string;
  prompt: string;
  sceneImageUrls: string[];
  targetImageUrl: string;
}): string | null {
  const meta = getQrTextToVideoModelDef(args.modelKey);
  const prompt = args.prompt.trim();
  if (!prompt) return "请填写提示词";

  const refs = resolveTextToVideoReferenceImageUrls(args);

  if (meta.usesImageTokens || isHappyHorseR2vModel(args.modelKey)) {
    if (!refs.length) return "请先上传至少一张参考图";
    const maxIdx = maxHappyHorsePromptImageIndex(prompt);
    if (maxIdx > refs.length) {
      return `提示词引用了 [Image ${maxIdx}]，但只有 ${refs.length} 张参考图`;
    }
    return null;
  }

  return null;
}
