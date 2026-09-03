import { FILM_PULL_MAX_VIDEO_SEC } from "@/lib/film-pull-limits";

/** 与 book-mall FILM_PULL_DEFAULT_ANALYZE_USER_PROMPT / skill 对齐的可编辑默认指令 */
export const DEFAULT_FILM_PULL_ANALYZE_PROMPT = `你作为资深影视工业化拉片分析师，接下来我会给到一段视频素材（≤${FILM_PULL_MAX_VIDEO_SEC}s），对该视频做逐镜全维度专业拉片。

**整段回复仅为 \`\`\`film-pull JSON**，在同一对象内填写：

1. **meta**（全片节奏/色彩/运镜/声音等）；
2. **shootingPrep**（场地/服装/道具/设备）；
3. **shots[]**（25 维 + cutDetail + audioInfo）；
4. **三块总结字符串字段**（须与 JSON 真源一致，不得只在长文写、字段留「无」）：
   - narrativeLogic（整体叙事逻辑拆解）
   - beatPoints（镜头卡点要点）
   - replicableShootingScript（可复刻拍摄脚本，含【准备】【拍摄清单】等）

【结构化必填 · 机器校验】
- shootingPrep.venue 禁止「无」；多数镜 sceneEnvironment / 布光 / 主体调度须有内容；
- cutTransition 仅写类型；动作切点写入 cutDetail（非末镜禁止「无」）；
- 全片节奏/切点密度写入 meta.editRhythmCurve，beatPoints 与之呼应；
- 每镜 audioInfo 四字段；时间为 number；禁止尾逗号；
- **禁止** Markdown 表格/前言/闲聊。`;

export function defaultFilmPullAnalyzePrompt(): string {
  return DEFAULT_FILM_PULL_ANALYZE_PROMPT;
}
