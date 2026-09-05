import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE,
  STORY_PRO2_FILM_PULL_INPUT_RULES,
  STORY_PRO2_JSON_FIELD_RULES,
  STORY_PRO2_JSON_OUTPUT_CONTRACT,
  STORY_PRO2_PACK_LANGUAGE_RULES,
  STORY_PRO2_PACK_OUTPUT_RULES,
  STORY_PRO2_PACK_PARSE_CONTRACT,
} from "@/lib/canvas/data/pro2-production-pack-standard";
import { FILM_PULL_V1_MAX_SEC } from "@/lib/ecom/ecom-film-pull-types";

const SKILL_PATH = resolve(__dirname, "../../doc/拉片/skill.md");

let cachedSkill: string | null = null;

function loadSkillMd(): string {
  if (cachedSkill) return cachedSkill;
  try {
    cachedSkill = readFileSync(SKILL_PATH, "utf8");
  } catch {
    cachedSkill = "";
  }
  return cachedSkill;
}

/** 每条拉片 user 消息末尾追加（服务端强制） */
export const FILM_PULL_JSON_DELIVERY_FOOTER = `
---
【交付格式 · 强制 · 最高优先级】
1. 回复**整段**仅为唯一围栏 \`\`\`pro2-production-script\`，内含**完整合法 JSON**（无注释、无尾逗号）。
2. **禁止** Markdown 分镜表、\`\`\`film-pull\`、列表、前言或闲聊；meta / visualStyle / shots[] / analysis 均须写在 JSON 内。
3. 须 step=full_pack · schemaVersion=3 · meta.source=film_pull · meta.packProfile=industrial。`.trim();

export function appendFilmPullJsonDeliveryFooter(userPrompt: string): string {
  const base = userPrompt.trim();
  if (!base) return FILM_PULL_JSON_DELIVERY_FOOTER;
  if (base.includes("【交付格式 · 强制")) return base;
  return `${base}\n\n${FILM_PULL_JSON_DELIVERY_FOOTER}`;
}

const FILM_PULL_V3_FENCE_CONTRACT = `
## 【最高优先级】机器可读交付 · 仅 \`\`\`pro2-production-script JSON

系统**只解析**回复中唯一围栏 \`\`\`pro2-production-script。**禁止** Markdown 分镜表 / \`\`\`film-pull\` / 前言 / 闲聊；展示由系统根据 JSON 渲染。

### 必须

1. 回复**整段**仅为唯一 \`\`\`pro2-production-script\`；
2. envelope：\`{ schemaVersion: 3, tier: "pro", step: "full_pack", patch: { ... } }\`；
3. \`patch.meta.source\` = \`film_pull\`；\`patch.meta.packProfile\` = \`industrial\`；
4. 每镜 shots[] 含导演表字段 + 嵌套 \`analysis\`（timing / cut / cinematography / blocking / look / narrative / audioInfo / analysisDraftPrompt）；
5. Pass1 **禁止** imagePrompt / videoPrompt / frameImagePrompt；
6. meta.totalDurationSec ≤ ${FILM_PULL_V1_MAX_SEC}s，与末镜 analysis.timing.endTimeSec 一致。

### 禁止

- 禁止 \`\`\`film-pull\` / \`\`\`json\` 代替 \`\`\`pro2-production-script\`；
- 禁止 GFM 分镜表或其它 Markdown 交付。

语法或结构化质量校验失败 → 整次拉片失败并重试。
`;

/** 校验失败重试（语法或质量） */
export function buildFilmPullAnalyzeRetryUserPrompt(reason: string): string {
  return appendFilmPullJsonDeliveryFooter(`上次输出未通过校验：${reason}

请**仅**重输出完整 \`\`\`pro2-production-script\` 围栏（无 Markdown），并严格遵守：
1. step=full_pack · meta.source=film_pull · meta.packProfile=industrial；
2. 每镜必填 analysis（含 cut.detail、blocking.sceneEnvironment、timing）；
3. meta.shootingPrep.venue 非「无」；多数镜 sceneEnvironment / subjectBlocking / lightingSetup 须有可观测内容；
4. 非末镜 analysis.cut.detail 写动作切点；
5. 禁止 Pass1 写 imagePrompt / videoPrompt / frameImagePrompt。`);
}

export function buildFilmPullAnalyzeSystemPrompt(): string {
  const skill = loadSkillMd().trim();
  return [
    FILM_PULL_V3_FENCE_CONTRACT,
    STORY_PRO2_FILM_PULL_INPUT_RULES,
    STORY_PRO2_PACK_PARSE_CONTRACT,
    STORY_PRO2_PACK_OUTPUT_RULES,
    STORY_PRO2_JSON_FIELD_RULES,
    PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE,
    STORY_PRO2_JSON_OUTPUT_CONTRACT,
    STORY_PRO2_PACK_LANGUAGE_RULES,
    skill ? `## 拉片业务参考（skill.md）\n${skill}` : "",
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");
}

export function buildFilmPullRenderScriptSystemPrompt(): string {
  return `${buildFilmPullAnalyzeSystemPrompt()}

## 当前任务 · 复刻脚本（render_script · 仍用 pro2-production-script v3）

你将收到完整拉片 v3 JSON 与新角色设定（含参考图描述）。
- 镜数、时间、转场、analysis、shootingPrep、场景、光影、audioInfo 全部继承；
- 只替换人物相关：analysis.blocking.subjectBlocking、analysis.blocking.sightDirection、analysis.analysisDraftPrompt；
- 必须保留 meta.source=film_pull 与 industrial shots[] 结构；
- **整段回复仅为** \`\`\`pro2-production-script JSON，禁止 Markdown。`;
}

export const FILM_PULL_DEFAULT_ANALYZE_USER_PROMPT =
  "请对我上传的这段视频做逐镜全维度专业拉片。整段回复仅为 ```pro2-production-script JSON（step=full_pack · meta.source=film_pull · meta.packProfile=industrial）。禁止 Markdown 表格或前言。";

export function buildFilmPullRenderScriptUserPrompt(opts: {
  analyzeJson: string;
  characterDescription: string;
  characterRefLabels: string[];
}): string {
  const refs =
    opts.characterRefLabels.length > 0
      ? opts.characterRefLabels.join("、")
      : "（无参考图标签）";
  return appendFilmPullJsonDeliveryFooter(`## 原拉片 JSON（v3 · 须继承镜序与时间）

${opts.analyzeJson}

## 新角色设定

${opts.characterDescription.trim() || "（见参考图）"}

## 参考图标签

${refs}

请输出 step=full_pack 的 pro2-production-script v3，仅替换人物相关 blocking / analysisDraftPrompt 字段。`);
}
