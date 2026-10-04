import {
  VTon_MODEL_BODY_PROPORTION_SPEC,
  VTon_MODEL_SUBTLE_POSE_NEGATIVE_ZH,
  VTon_MODEL_SUBTLE_POSE_SPEC,
} from "@/lib/ecom/ecom-vton/prompts";

import { SIMPLE_FUSION_PROMPT_BODIES, type SimpleFusionVariant } from "./constants";
import type { SimpleFusionReferences } from "./types";

/** 与模特试衣底图一致的 9:16 全身构图（融图专用 · 多段正文） */
export const SIMPLE_FUSION_FUSION_COMPOSITION_BLOCK = [
  "镜头与构图：竖向 9:16 电商人像，中远景 fashion catalog 全身构图。",
  VTon_MODEL_BODY_PROPORTION_SPEC,
  VTon_MODEL_SUBTLE_POSE_SPEC,
  "单人站立正面完整全身照：头顶、发际、双臂、双手、躯干、双腿、双脚与鞋子必须全部在画面内；",
  "留出头顶与足尖下方少量留白，人物约占画面高度 85%。",
  "禁止半身照、禁止裁切手腕/手掌/脚踝/脚部、禁止看不到鞋子、禁止缺失手臂或腿部。",
].join("\n");

const FUSION_CROP_NEGATIVE_ZH =
  "半身照，裁切脚踝，裁切脚部，看不到鞋，缺失手臂，缺失手，缺失腿，无脚，截断肢体，大头照，近景特写";

export function simpleFusionFusionNegativePrompt(variant: SimpleFusionVariant): string {
  const base = SIMPLE_FUSION_PROMPT_BODIES[variant].negative;
  return [base, FUSION_CROP_NEGATIVE_ZH, VTon_MODEL_SUBTLE_POSE_NEGATIVE_ZH].join("，");
}

/**
 * 静态融合 Prompt（对齐模特试衣 · 分段 + 句内 @ 引用，不用「@模特 @服装1 @服装2」前缀堆叠）。
 * @param garmentIndex 1-based，对应当前轮次服装参考图顺序。
 */
export function buildSimpleFusionFusionPrompt(
  variant: SimpleFusionVariant,
  references: SimpleFusionReferences,
  garmentIndex: number,
): string {
  const idx = Math.max(1, garmentIndex);
  const garmentToken = `@服装${idx}`;
  const hasSceneImg = Boolean(references.scene?.ossUrl?.trim());

  const identity = [
    "【人物】",
    `以 @模特1 为唯一人物依据，输出同一人的高清融合成片。`,
    "五官、脸型、妆发、肤色与体型须与 @模特1 一致，禁止换脸、禁止 AI 美颜与过度磨皮。",
  ].join("\n");

  const garment = [
    "【服装】",
    `模特穿着 ${garmentToken} 所示整套服装（仅本轮该套，不得混入其他服装参考）。`,
    "精准还原该套的版型结构、廓形、面料质感、褶皱与印花/配色细节。",
  ].join("\n");

  const sceneBlocks: string[] = [];
  if (variant === "mirror") {
    sceneBlocks.push(
      [
        "【场景】",
        hasSceneImg
          ? "模特正面全身站在户外落地镜前，环境参考 @场景1，镜子透视与反射结构正常。"
          : "模特正面全身站在户外落地镜前，镜子透视与反射结构正常。",
        "户外柔和自然光，手机自拍种草质感，人物与场景光影融合自然。",
      ].join("\n"),
    );
  } else if (variant === "dance") {
    sceneBlocks.push(
      [
        "【场景】",
        hasSceneImg
          ? "人物自然融入 @场景1 所示环境，适配场景光线与透视，地面投影真实。"
          : "人物与背景光影统一，画面适合竖屏短视频卡点展示。",
        "背景简洁不抢主体，穿搭清晰可读。",
      ].join("\n"),
    );
  } else {
    sceneBlocks.push(
      [
        "【场景】",
        hasSceneImg
          ? "将人物自然放置到 @场景1 场景中，适配环境光线，投影与融合真实。"
          : "商业棚拍或简洁场景，光影统一，画面干净高级。",
      ].join("\n"),
    );
  }

  const composition = ["【构图与姿态】", SIMPLE_FUSION_FUSION_COMPOSITION_BLOCK].join("\n");

  const tail =
    variant === "camera"
      ? "【成片要求】高清商业穿搭摄影，稳定站立，便于后续图生视频运镜。"
      : variant === "mirror"
        ? "【成片要求】对镜 OOTD 全身展示，便于后续图生视频。"
        : "【成片要求】竖屏短视频质感，全身稳定，便于后续图生视频卡点。";

  return [identity, garment, ...sceneBlocks, composition, tail].join("\n\n");
}
