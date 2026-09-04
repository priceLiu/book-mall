export const OUTFIT_V1_TEMPLATE_ID = "outfit-v1" as const;

export const ECOM_OUTFIT_VIDEO_MODULE = "video-outfit";
export const ECOM_OUTFIT_VIDEO_TOOL_KEY = "ecom-toolkit__video-outfit";

export const OUTFIT_V1_POSITIVE_PROMPT =
  "9:16竖屏，商业电商穿搭短视频，高清画质，真实服装面料，画面稳定流畅";

export const OUTFIT_V1_NEGATIVE_PROMPT =
  "肢体畸形，身体扭曲，人脸漂移闪烁，服装褶皱错乱，画面闪烁抖动，图像模糊，曝光异常，多余肢体，卡通动漫画风";

export const OUTFIT_V1_DEFAULT_VIDEO_CONFIG = {
  resolution: "1080*1920",
  fps: 30,
  aspectRatio: "9:16" as const,
  actionFidelity: "high" as const,
};

export const OUTFIT_V1_DEFAULT_GENERATE_CONSTRAINT = {
  keepModelIdentity: true,
  keepClothingShape: true,
  keepClothingColor: true,
  disableBodyDistortion: true,
  disableFlicker: true,
};

export const OUTFIT_V1_DEFAULT_SPLIT_CONFIG = {
  minSceneDurationSec: 2,
  maxSceneDurationSec: 4,
};

/** 真实拆镜后默认：Kling 动作控制（保留参考片段场景/光影/运镜，仅换模特） */
export const OUTFIT_V1_DEFAULT_VIDEO_MODEL = "kling-3.0/motion-control";

export const OUTFIT_V1_LLM_JSON_PREFIX =
  "You are a professional video scene analysis and generation engine. You must only return a complete standard JSON object. Do not return any text, explanation, markdown, symbol outside the json. All fields must strictly match the definition, no missing fields, no random content.";
