import { FILM_PULL_MAX_VIDEO_SEC } from "@/lib/film-pull-limits";

/** 与 book-mall FILM_PULL_DEFAULT_ANALYZE_USER_PROMPT / skill 对齐的可编辑默认指令 */
export const DEFAULT_FILM_PULL_ANALYZE_PROMPT = `你作为资深影视工业化拉片分析师，接下来我会给到一段视频素材（≤${FILM_PULL_MAX_VIDEO_SEC}s），对该视频做逐镜全维度专业拉片，严格按照下面要求输出：

1. **先**在 \`\`\`film-pull JSON 中完整填写结构化真源：meta（全片节奏/色彩/运镜/声音）、shootingPrep（场地/服装/道具/设备）、shots[]（25 维 + cutDetail + audioInfo）；
2. 再输出 Markdown 分镜总览表（与 shots 一致）及 shootingPrep 摘要；
3. 再输出三块**总结性长文**（须与 JSON 完全一致，不得只在长文写、表格留「无」）：
   - 整体叙事逻辑拆解（narrativeLogic）
   - 镜头卡点要点（beatPoints）
   - 可直接落地复刻的同款拍摄脚本（replicableShootingScript，含【准备】【拍摄清单】等）
4. 最末尾输出唯一 \`\`\`film-pull JSON 围栏。

【结构化必填 · 机器校验】
- shootingPrep.venue 禁止「无」；多数镜 sceneEnvironment / 布光 / 主体调度须有内容；
- cutTransition 仅写类型；动作切点写入 cutDetail（非末镜禁止「无」）；
- 全片节奏/切点密度写入 meta.editRhythmCurve，beatPoints 长文与之呼应；
- 每镜 audioInfo 四字段；时间为 number；禁止尾逗号。

格式简洁，只输出可落地内容，不要闲聊。`;

export function defaultFilmPullAnalyzePrompt(): string {
  return DEFAULT_FILM_PULL_ANALYZE_PROMPT;
}
