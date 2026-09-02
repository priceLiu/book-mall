import type { MediaDecomposeKind } from "@/lib/media-decompose-types";

export const DEFAULT_VIDEO_DECOMPOSE_PROMPT = `你作为资深影视分镜&镜头语言分析师，接下来我会给到一段视频素材，对该视频做完整主体反推分镜拆解，严格按照下面要求输出：

1. 先输出标准结构化分镜表格，表格固定字段：镜号、时长、景别、运镜、镜头角度、构图方式、画面内容、人物动作、表情、字幕文案、**口播文案**、音效、BGM、转场、剪辑节奏；镜头术语必须专业精准，单镜头时长贴合短视频主流节奏。**JSON 中每镜必须用英文字段 voiceover 填写口播/旁白原文**（有口播时不可留空；与字幕相同时 subtitle 与 voiceover 可写同样内容）。
2. 表格之后额外输出三块内容：整体叙事逻辑拆解、镜头卡点要点、可直接落地复刻的同款拍摄脚本。
3. 整体格式简洁，逻辑清晰，只输出可直接落地执行的内容，不要多余闲聊废话。`;

export const DEFAULT_IMAGE_DECOMPOSE_PROMPT = `你作为资深视觉画面解析师，接下来我会上传一张静态画面（产品图/宣传图/氛围感图均可），对图片进行完整反推拆解，严格按以下要求输出：

1. 先拆解画面底层要素：画面主体、主体姿态、场景环境、空间透视、构图方式、镜头参数等效焦距、拍摄角度、布光方案（主光/辅光/轮廓光/环境光，光源方向、软硬、色温）、材质质感、色彩体系、画面氛围、画面细节瑕疵/修饰点。
2. 基于拆解内容生成两套提示词：正向生成提示词（可直接投喂AI绘图）、反向负面提示词；同时附带实拍复刻方案：机位摆放、灯光布置、道具搭配、相机参数参考。
3. 格式条理清晰，全部内容直接落地可用，不要多余闲聊废话。`;

export function defaultPromptForKind(kind: MediaDecomposeKind | null | undefined): string {
  return kind === "video" ? DEFAULT_VIDEO_DECOMPOSE_PROMPT : DEFAULT_IMAGE_DECOMPOSE_PROMPT;
}
