/** 换背景表单（图片分层 / 模特换装共用） */
export type BackgroundReplaceEdgeDraft = {
  url: string;
  prompt: string;
};

export const BACKGROUND_REPLACE_SEEDREAM_MODEL = "doubao-seedream-5-0-pro";
export const BACKGROUND_REPLACE_WANX_MODEL = "wanx-background-generation-v2";

export const BACKGROUND_REPLACE_MODEL_KEYS = [
  BACKGROUND_REPLACE_SEEDREAM_MODEL,
  BACKGROUND_REPLACE_WANX_MODEL,
] as const;

export type BackgroundReplaceFormState = {
  modelKey: string;
  refPrompt: string;
  refImageUrl: string;
  negRefPrompt: string;
  modelVersion: "v2" | "v3";
  n: number;
  noiseLevel: number;
  refPromptWeight: number;
  foregroundEdges: BackgroundReplaceEdgeDraft[];
  backgroundEdges: BackgroundReplaceEdgeDraft[];
};

export const DEFAULT_BACKGROUND_REPLACE_FORM: BackgroundReplaceFormState = {
  modelKey: BACKGROUND_REPLACE_SEEDREAM_MODEL,
  refPrompt: "",
  refImageUrl: "",
  negRefPrompt: "",
  modelVersion: "v3",
  n: 1,
  noiseLevel: 300,
  refPromptWeight: 0.5,
  foregroundEdges: [],
  backgroundEdges: [],
};

export function isWanxBackgroundReplaceModel(modelKey: string): boolean {
  return modelKey.trim() === BACKGROUND_REPLACE_WANX_MODEL;
}

export function isSeedreamBackgroundReplaceModel(modelKey: string): boolean {
  const k = modelKey.trim();
  return (
    k === BACKGROUND_REPLACE_SEEDREAM_MODEL ||
    k === "doubao-seedream-5-0-pro-260628"
  );
}

export function canSubmitBackgroundReplace(
  form: BackgroundReplaceFormState,
  hasBase: boolean,
): boolean {
  if (!hasBase) return false;
  if (isWanxBackgroundReplaceModel(form.modelKey)) {
    return Boolean(form.refPrompt.trim() || form.refImageUrl.trim());
  }
  return Boolean(form.refPrompt.trim());
}
