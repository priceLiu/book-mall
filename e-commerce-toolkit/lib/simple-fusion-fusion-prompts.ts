import {
  SIMPLE_FUSION_PROMPT_BODIES,
  type SimpleFusionVariant,
} from "@/lib/simple-fusion-default-prompts";
import type { SimpleFusionProject } from "@/lib/ecom-simple-fusion-video-api";

/** 与 book-mall `simple-fusion-video/fusion-prompts.ts` 保持语义一致（前端展示用） */
export const SIMPLE_FUSION_FUSION_COMPOSITION_BLOCK = [
  "镜头与构图：竖向 9:16 电商人像，中远景 fashion catalog 全身构图。",
  "成人时装模特真实人体比例：全身约 7.5～8 头身，头部高度约占全身 1/7～1/8；",
  "肩宽约为头宽的 2～2.5 倍，颈、躯干、四肢长度协调，禁止 Q 版、卡通或儿童比例；",
  "电商试衣底图轻微自然站姿：正面站立，双肩放松，双脚自然分开约肩宽；",
  "双臂垂于身侧略有弧度，双手空手，不插兜、不叉腰、不挡躯干；",
  "单人站立正面完整全身照：头顶、双臂、双手、双腿、双脚与鞋子必须全部在画面内；",
  "留出头顶与足尖下方少量留白，人物约占画面高度 85%。",
  "禁止半身照、禁止裁切手腕/手掌/脚踝/脚部、禁止看不到鞋子、禁止缺失手臂或腿部。",
].join("\n");

export function buildSimpleFusionFusionPrompt(
  variant: SimpleFusionVariant,
  references: SimpleFusionProject["references"],
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

export function simpleFusionFusionNegativePrompt(variant: SimpleFusionVariant): string {
  const base = SIMPLE_FUSION_PROMPT_BODIES[variant].negative;
  const crop =
    "半身照，裁切脚踝，裁切脚部，看不到鞋，缺失手臂，缺失手，缺失腿，无脚，截断肢体，大头照，近景特写";
  const pose =
    "僵硬 T-pose，双臂笔直贴死身体，叉腰，抱胸，双手插兜，大幅抬手，交叉腿，大迈步，截断构图";
  return [base, crop, pose].join("，");
}
