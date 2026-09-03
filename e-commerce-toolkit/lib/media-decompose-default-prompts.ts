import type { MediaDecomposeKind } from "@/lib/media-decompose-types";

/** 与 book-mall ecom-media-decompose-prompts.ts DEFAULT_VIDEO_DECOMPOSE_USER_PROMPT 保持一致 */
export const DEFAULT_VIDEO_DECOMPOSE_PROMPT = `你作为资深影视分镜&镜头语言分析师，接下来我会给到一段视频素材，请做完整反推分镜拆解。

**整段回复仅为 \`\`\`media-decompose JSON**（见 System 契约），要求：

1. **JSON 根字段**：visualStyle、globalColorTone、cameraLanguageSummary、scenePrep（venue、fixedProps）、storyboardTable、narrativeLogic、beatPoints、replicableShootingScript。
2. **storyboardTable 每镜英文字段**：shotNo、duration、shotSize、cameraMove、cameraAngle、composition、lightingSetup、toneContrast、visualContent、characterAction、expression、subtitle、**voiceover**、sfx、bgm、transition、editRhythm。
3. **口播**：有旁白/配音时，每镜 **voiceover 必须填写原文**（与字幕相同时 subtitle 与 voiceover 可写同样内容）。
4. **运镜 cameraMove**：固定机位/慢推/横移跟拍/手持微晃等可执行术语；禁止空话；本镜在动时禁止填「无」。
5. **布光/影调**：lightingSetup、toneContrast 每镜必填；可见光影时禁止「无」。
6. 禁止 Markdown 表格/前言/闲聊。`;

/** 与 book-mall ecom-media-decompose-prompts.ts DEFAULT_IMAGE_DECOMPOSE_USER_PROMPT 保持一致 */
export const DEFAULT_IMAGE_DECOMPOSE_PROMPT = `你作为资深视觉画面解析师，接下来我会上传一张静态画面，请做完整反推拆解。

**整段回复仅为 \`\`\`media-decompose JSON**（见 System 契约），要求：

1. **elements** 对象：主体、姿态、场景、透视、构图、等效焦距、拍摄角度、lighting 子对象（主/辅/轮廓/环境光、方向、软硬、色温）、材质、色彩体系、氛围、细节。
2. **positivePrompt**：须体现布光 + 色彩体系 + 画面氛围，可直接用于 AI 绘图。
3. **negativePrompt**：反向负面提示词。
4. **liveActionReplication**：机位、灯光、道具、相机参数。
5. 禁止 Markdown 表格/前言/闲聊。`;

export function defaultPromptForKind(kind: MediaDecomposeKind | null | undefined): string {
  return kind === "video" ? DEFAULT_VIDEO_DECOMPOSE_PROMPT : DEFAULT_IMAGE_DECOMPOSE_PROMPT;
}
