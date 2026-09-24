/** 换背景表单（图片分层 / 模特换装共用） */
export type BackgroundReplaceEdgeDraft = {
  url: string;
  prompt: string;
};

export type BackgroundReplaceFormState = {
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

export function canSubmitBackgroundReplace(
  form: BackgroundReplaceFormState,
  hasBase: boolean,
): boolean {
  if (!hasBase) return false;
  return Boolean(form.refPrompt.trim() || form.refImageUrl.trim());
}
