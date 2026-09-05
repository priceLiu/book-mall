import type {
  ModelShotBrief,
  ModelShotPoseItem,
  ModelShotReference,
} from "@/lib/ecom/ecom-model-shot-types";
import { refByRole } from "@/lib/ecom/ecom-model-shot-types";

export function resolveModelShotSceneText(
  references: ModelShotReference[],
  brief: ModelShotBrief | null,
): string {
  const scene = refByRole(references, "scene");
  if (scene?.source === "none") {
    const styleHint = brief?.styles?.filter(Boolean).join("、");
    const platform = brief?.platform;
    const hints = [styleHint, platform ? `适合${platform}展示` : ""].filter(Boolean);
    return hints.length > 0
      ? `场景氛围由模型自由发挥，${hints.join("，")}，自然光电商展示`
      : "场景氛围由模型自由发挥，自然光，适合电商展示";
  }
  if (scene?.source === "text" && scene.description) return scene.description;
  if (scene?.name) return `采用场景「${scene.name}」`;
  if (scene?.ossUrl) return "背景按场景参考图";
  return "专业电商摄影棚，均匀柔光";
}

export function resolveModelShotPropText(references: ModelShotReference[]): string {
  const prop = refByRole(references, "prop");
  if (!prop || prop.source === "none") return "";
  if (prop.description) return prop.description;
  if (prop.name) return prop.name;
  return "";
}

function formatPropSegment(propText: string): string {
  const trimmed = propText.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("道具：") ? trimmed : `道具：${trimmed}`;
}

export function assembleModelShotPrompt(opts: {
  poseDescription: string;
  brief: ModelShotBrief | null;
  references: ModelShotReference[];
  garmentDescription?: string;
  sceneText?: string;
  propText?: string;
  hasPoseRef?: boolean;
}): string {
  const garment = refByRole(opts.references, "garment");
  const model = refByRole(opts.references, "model");

  const modelLock =
    model?.source === "text" && model.description
      ? model.description
      : model?.ossUrl
        ? "参考图像中的人物身份保持不变"
        : "时尚模特";

  const garmentText =
    opts.garmentDescription?.trim() ||
    garment?.description?.trim() ||
    "待展示服装款式与颜色与服装参考图完全一致";

  const scenePart =
    opts.sceneText?.trim() ||
    resolveModelShotSceneText(opts.references, opts.brief);

  const propRaw =
    opts.propText !== undefined
      ? opts.propText.trim()
      : resolveModelShotPropText(opts.references);
  const propPart = formatPropSegment(propRaw);
  let negativeProp = "无额外配饰";
  if (propPart) negativeProp = "";

  const platform = opts.brief?.platform ?? "电商";
  const platformHint =
    platform.includes("淘宝") || platform.includes("电商")
      ? "动作克制，清晰展示服装，少遮挡衣物"
      : platform.includes("抖音")
        ? "动作幅度稍大，强调腿部线条"
        : "生活感强，适度抓拍感";

  const parts = [
    "全身人像摄影",
    modelLock,
    `穿着${garmentText}`,
    opts.poseDescription,
    scenePart,
    propPart,
    opts.hasPoseRef
      ? "严格参考姿势参考图的身体姿态与构图，不改变服装款式与模特身份"
      : "",
    `${platformHint}，高清，自然光，无水印`,
  ].filter(Boolean);

  const negatives = ["畸形肢体", "多余手指", negativeProp].filter(Boolean);

  return `${parts.join("，")}。负面：${negatives.join("，")}。`;
}

export function rebuildModelShotItemPrompt(opts: {
  item: Pick<
    ModelShotPoseItem,
    "poseDescription" | "sceneText" | "propText" | "prompt" | "promptEdited" | "poseRefUrl"
  >;
  brief: ModelShotBrief | null;
  references: ModelShotReference[];
}): string {
  const hasStructuredFields =
    opts.item.poseDescription !== undefined ||
    opts.item.sceneText !== undefined ||
    opts.item.propText !== undefined;

  if (hasStructuredFields) {
    return assembleModelShotPrompt({
      poseDescription: opts.item.poseDescription?.trim() || "",
      brief: opts.brief,
      references: opts.references,
      sceneText: opts.item.sceneText,
      propText: opts.item.propText,
      hasPoseRef: Boolean(opts.item.poseRefUrl?.trim()),
    });
  }

  return opts.item.prompt?.trim() || "";
}
