/** 与 book-mall `ecom-vton-model-body-preset` 预设 id 对齐（仅展示文案） */

export type VtonModelBodyPresetId =
  | "slim"
  | "standard"
  | "athletic"
  | "curvy"
  | "soft"
  | "plus"
  | "tall_slim"
  | "petite";

export type VtonModelAgeGroupId = "youth" | "young_adult" | "mature";

export type VtonModelPipelineRatio = "1:1" | "3:4" | "4:5" | "16:9" | "9:16";

export const VTON_MODEL_PIPELINE_RATIO_OPTIONS: Array<{
  value: VtonModelPipelineRatio;
  label: string;
}> = [
  { value: "3:4", label: "3:4" },
  { value: "9:16", label: "9:16" },
  { value: "4:5", label: "4:5" },
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
];

export const VTON_MODEL_BODY_PRESET_OPTIONS: Array<{
  value: VtonModelBodyPresetId;
  label: string;
  hint: string;
}> = [
  { value: "slim", label: "纤细", hint: "修长健康体型" },
  { value: "standard", label: "标准", hint: "电商试衣常用" },
  { value: "athletic", label: "运动", hint: "肩背线条明显" },
  { value: "curvy", label: "曲线", hint: "丰满协调" },
  { value: "soft", label: "微胖", hint: "圆润柔和" },
  { value: "plus", label: "大码", hint: "大码时装展示" },
  { value: "tall_slim", label: "高挑", hint: "长腿比例" },
  { value: "petite", label: "娇小", hint: "小尺度成人" },
];

export const VTON_MODEL_AGE_GROUP_OPTIONS: Array<{
  value: VtonModelAgeGroupId;
  label: string;
}> = [
  { value: "youth", label: "青年" },
  { value: "young_adult", label: "轻熟" },
  { value: "mature", label: "成熟" },
];

export function coerceVtonModelBodyPresetId(raw?: string | null): VtonModelBodyPresetId {
  const v = raw?.trim();
  if (v && VTON_MODEL_BODY_PRESET_OPTIONS.some((o) => o.value === v)) {
    return v as VtonModelBodyPresetId;
  }
  return "standard";
}

export function coerceVtonModelAgeGroupId(raw?: string | null): VtonModelAgeGroupId {
  const v = raw?.trim();
  if (v && VTON_MODEL_AGE_GROUP_OPTIONS.some((o) => o.value === v)) {
    return v as VtonModelAgeGroupId;
  }
  return "youth";
}

export function coerceVtonModelPipelineRatio(raw?: string | null): VtonModelPipelineRatio {
  const v = raw?.trim();
  if (v && VTON_MODEL_PIPELINE_RATIO_OPTIONS.some((o) => o.value === v)) {
    return v as VtonModelPipelineRatio;
  }
  return "3:4";
}
