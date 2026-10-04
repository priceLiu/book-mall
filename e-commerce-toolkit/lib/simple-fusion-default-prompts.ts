export type SimpleFusionVariant = "camera" | "mirror" | "dance";

/** 固定模板正文（@ 引用由 buildSimpleFusionAutoPrompts 按已上传素材自动前缀） */
export const SIMPLE_FUSION_PROMPT_BODIES: Record<
  SimpleFusionVariant,
  { fusion: string; video: string; negative: string }
> = {
  camera: {
    fusion:
      "保留模特五官与身形，精准还原服装的版型、面料与印花细节，人物正面全身站立，自然融入场景，光影匹配统一，高清商业穿搭摄影，画面干净高级。",
    video:
      "9:16竖屏，商业服装展示视频，模特稳定站立，几乎无肢体动作，画面变化以缓慢摄像机推拉、轻微环绕运镜为主，清晰展示服装整体版型与面料细节，画面稳定流畅，高清真实。",
    negative:
      "肢体畸形，手部崩坏，人脸漂移，大幅度动作，跳舞，跑动，画面闪烁，模糊，曝光异常，多余肢体",
  },
  mirror: {
    fusion:
      "模特正面全身站立在户外落地镜前，精准还原服装版型与面料细节，保留模特原始五官样貌，完美融合场景光影，镜子透视结构正常，高清手机自拍质感。",
    video:
      "9:16竖屏，小红书OOTD对镜自拍，模特在落地镜前自然转身、侧身展示全身穿搭，动作松弛自然，轻微整理头发，户外柔和自然光，画面稳定流畅，生活种草氛围。",
    negative:
      "镜子透视错误，镜像人脸崩坏，镜像人物重复，肢体畸形，大幅度跳动，画面闪烁，脸部变形，多余肢体",
  },
  dance: {
    fusion:
      "保留模特五官样貌不变，精准还原当前轮次服装的版型、面料与印花细节，人物全身站立，完美匹配场景与光影，高清短视频质感。",
    video:
      "9:16竖屏，短视频卡点律动，模特轻微活力跳舞，动作流畅自然，人物五官不变，场景背景不变，穿搭展示清晰，画面稳定，氛围感强。",
    negative:
      "人脸漂移，肢体畸形，鬼手，大幅度崩坏，画面闪烁，场景变动，五官变动，服装变形，扭曲",
  },
};

/** @deprecated 无素材时的占位；有素材请用 buildSimpleFusionAutoPrompts */
export const SIMPLE_FUSION_DEFAULT_PROMPTS = SIMPLE_FUSION_PROMPT_BODIES;

export function moduleToVariant(module: string): SimpleFusionVariant {
  if (module === "video-mirror-selfie") return "mirror";
  if (module === "video-dance-swap") return "dance";
  return "camera";
}

export const SIMPLE_FUSION_BGM_PRESETS = [
  { id: "beat-1", label: "活力卡点 1" },
  { id: "beat-2", label: "活力卡点 2" },
  { id: "beat-3", label: "轻快律动" },
] as const;
