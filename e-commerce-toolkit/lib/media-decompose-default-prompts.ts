import type { MediaDecomposeKind } from "@/lib/media-decompose-types";

/** 与 book-mall ecom-media-decompose-prompts.ts DEFAULT_VIDEO_DECOMPOSE_USER_PROMPT 保持一致 */
export const DEFAULT_VIDEO_DECOMPOSE_PROMPT = `你作为资深影视分镜&镜头语言分析师，接下来我会给到一段视频素材，请做完整反推分镜拆解。

**整段回复仅为 \`\`\`media-decompose JSON**（见 System 契约），要求：

1. **JSON 根字段**：visualStyle、globalColorTone、cameraLanguageSummary、scenePrep（venue、fixedProps）、openingHook、fullTranscript、talentAnalysis、wardrobeAnalysis、storyboardTable、narrativeLogic、beatPoints、replicableShootingScript。
2. **开场 0–3 秒 openingHook**（独立章节，禁止打进分镜行）：firstFrame=第 0 秒画面/表情/花字；first3sLines=0–3 秒全部人声原文，无则「【无任何人声】」。
3. **完整台词全文 fullTranscript**：全片人声对白/旁白/解说连续原文，不要额外解说；无则「【无任何人声】」。
4. **模特分析 talentAnalysis**（**全片**，不是前 3 秒）：count、appearance、expressionStyle、blocking；无出镜模特写「【无出镜模特】」。
5. **模特服装 wardrobeAnalysis**（**全片**穿着与换装）：garments、changes、stylingNotes。
6. **storyboardTable 每镜英文字段**：shotNo、duration、shotSize、cameraMove、cameraAngle、composition、lightingSetup、toneContrast、visualContent、characterAction、expression、subtitle、**voiceover**、sfx、bgm、transition、editRhythm。
7. **口播 voiceover**：有人声时每镜只填该镜时段原文；该镜无人声则留空；禁止同一句复制到多镜。若附有 ASR 时间轴，台词以 ASR 为准、禁止改写。
8. **运镜 cameraMove**：固定机位/慢推/横移跟拍/手持微晃等可执行术语；禁止空话；本镜在动时禁止填「无」。
9. **布光/影调**：lightingSetup、toneContrast 每镜必填；可见光影时禁止「无」。
10. **narrativeLogic**：按时间/镜序写全片叙事弧线与卖点推进，详实不写一句带过。
11. **beatPoints**：带秒数/时间码的卡点清单；每条须含画面事件 + 运镜方式 + 转场/切换类型（硬切/叠化/划像/匹配剪辑/J-Cut/L-Cut 等）。
12. **replicableShootingScript**：可直接落地的复刻脚本；须写机位与高度、运镜轨迹、镜头切换节奏、布光、模特走位/动作、BGM 与口播时段。
13. 禁止 Markdown 表格/前言/闲聊。`;

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
