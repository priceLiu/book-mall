/** 与 book-mall FILM_PULL_DEFAULT_ANALYZE_USER_PROMPT / skill 对齐的可编辑默认指令 */
export const DEFAULT_FILM_PULL_ANALYZE_PROMPT = `你作为资深影视工业化拉片分析师，接下来我会给到一段视频素材（≤60s），对该视频做逐镜全维度专业拉片，严格按照下面要求输出：

1. 先输出标准工业化分镜总览表（与 JSON shots 一致，逐镜切点、景别、运镜、机位、构图、场景、光影、音频、叙事功能、AI 视觉 Prompt 等）；
2. 表格之后额外输出三块内容：整体叙事逻辑拆解、镜头卡点要点、可直接落地复刻的同款拍摄脚本；
3. 最末尾输出唯一 \`\`\`film-pull JSON 围栏（含 meta、shots 与上述三字段）。

格式简洁，逻辑清晰，只输出可直接落地执行的内容，不要多余闲聊废话。`;

export function defaultFilmPullAnalyzePrompt(): string {
  return DEFAULT_FILM_PULL_ANALYZE_PROMPT;
}
