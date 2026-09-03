import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { FILM_PULL_V1_MAX_SEC } from "@/lib/ecom/ecom-film-pull-types";

const SKILL_PATH = resolve(__dirname, "../../doc/拉片/skill.md");
const TABLE_PATH = resolve(__dirname, "../../doc/拉片/table-format.md");

let cachedSkill: string | null = null;
let cachedTable: string | null = null;

function loadSkillMd(): string {
  if (cachedSkill) return cachedSkill;
  try {
    cachedSkill = readFileSync(SKILL_PATH, "utf8");
  } catch {
    cachedSkill = "";
  }
  return cachedSkill;
}

function loadTableMd(): string {
  if (cachedTable) return cachedTable;
  try {
    cachedTable = readFileSync(TABLE_PATH, "utf8");
  } catch {
    cachedTable = "";
  }
  return cachedTable;
}

/** 每条拉片 user 消息末尾追加（服务端强制） */
export const FILM_PULL_JSON_DELIVERY_FOOTER = `
---
【交付格式 · 强制 · 最高优先级】
1. 回复**整段**仅为唯一围栏 \`\`\`film-pull ，内含**完整合法 JSON**（无注释、无尾逗号）。
2. **禁止** Markdown 分镜表、列表、前言或闲聊；\`meta\` / \`shootingPrep\` / \`shots\` / 三块总结均须写在 JSON 内。
3. 围栏语言标记必须是 \`film-pull\`，**禁止** \`json\` / \`media-decompose\` 等代替。`.trim();

export function appendFilmPullJsonDeliveryFooter(userPrompt: string): string {
  const base = userPrompt.trim();
  if (!base) return FILM_PULL_JSON_DELIVERY_FOOTER;
  if (base.includes("【交付格式 · 强制")) return base;
  return `${base}\n\n${FILM_PULL_JSON_DELIVERY_FOOTER}`;
}

const FILM_PULL_FENCE_CONTRACT = `
## 【最高优先级】机器可读交付 · 仅 \`\`\`film-pull JSON

系统**只解析**回复中唯一围栏 \`\`\`film-pull。**禁止** Markdown 分镜表 / 前言 / 闲聊；展示由系统根据 JSON 渲染。

### 必须

1. 回复**整段**仅为唯一 \`\`\`film-pull（语言标记必须是 film-pull）；
2. 在**同一个 JSON 对象**内完整填写 \`meta\`、\`shootingPrep\`、\`shots[]\`（含每镜 cutDetail）、以及三块总结字段 \`narrativeLogic\` / \`beatPoints\` / \`replicableShootingScript\`；
3. 三块总结为 JSON **字符串字段**（可含 \\n），须与 meta/shots 一致、不得超集。

### 类型与必填
| 字段 | 类型 | 规则 |
|------|------|------|
| schemaVersion | number | 固定 \`1\` |
| action | string | \`analyze_complete\` |
| meta.totalDurationSec | number | 与末镜 endTimeSec 一致（≤${FILM_PULL_V1_MAX_SEC}s） |
| meta 其余 6 项 | string | 非空；全片节奏/色彩/运镜/声音须写入 meta |
| shootingPrep | object | venue / costume / props / equipment 四字段非空；**venue 禁止「无」** |
| narrativeLogic / beatPoints / replicableShootingScript | string | **总结性长文**，必填，与 JSON 真源一致 |
| shots | array | 每镜 25 维 + **cutDetail** + audioInfo |
| cutTransition | string | 仅类型：硬切/叠化/闪白… |
| cutDetail | string | 入出点/动作切点；**非末镜禁止「无」** |
| sceneEnvironment 等 | string | 非空；**多数镜禁止「无」**（见 skill.md） |

### 镜序与时间
- 每次硬切 = 一镜；shotNo 从 1 递增；时间字段为 number

### 禁止
- 禁止 Markdown 分镜总览表或其它 Markdown 交付；
- 禁止 \`\`\`json\` / \`\`\`media-decompose\` 代替 \`\`\`film-pull\`。

完整示例见 table-format.md。语法或结构化质量校验失败 → 整次拉片失败并重试。
`;

/** 校验失败重试（语法或质量） */
export function buildFilmPullAnalyzeRetryUserPrompt(reason: string): string {
  return appendFilmPullJsonDeliveryFooter(`上次输出未通过校验：${reason}

请**仅**重输出完整 \`\`\`film-pull 围栏（无 Markdown），并严格遵守：
1. 同一 JSON 内填 meta、shootingPrep、shots（含 cutDetail）与三块总结长文字段；
2. shootingPrep.venue 非「无」；多数镜 sceneEnvironment / subjectBlocking / lightingSetup 须有可观测内容；
3. 非末镜 cutDetail 写动作切点；beatPoints 中的切点须在 cutDetail 出现；
4. 【准备】场地/服装/道具/设备 → shootingPrep；本镜道具 → dynamicProps；
5. schemaVersion=1、时间为 number、每镜 audioInfo 四字段、禁止尾逗号。`);
}

export function buildFilmPullAnalyzeSystemPrompt(): string {
  const skill = loadSkillMd().trim();
  const table = loadTableMd().trim();
  return [FILM_PULL_FENCE_CONTRACT, table, skill].filter(Boolean).join("\n\n---\n\n");
}

export function buildFilmPullRenderScriptSystemPrompt(): string {
  return `${buildFilmPullAnalyzeSystemPrompt()}

## 当前任务 · render_script_complete

你将收到完整拉片 JSON 与新角色设定（含参考图描述）。
- 镜数、时间、转场、cutDetail、shootingPrep、场景、光影、audioInfo 全部继承；
- 只替换人物相关：subjectBlocking、sightDirection、aiVisualPrompt；
- 必须输出 renderGlobalConfig；
- action 固定 render_script_complete；
- **整段回复仅为** \`\`\`film-pull JSON，禁止 Markdown。`;
}

export const FILM_PULL_DEFAULT_ANALYZE_USER_PROMPT =
  "请对我上传的这段视频做逐镜全维度专业拉片。整段回复仅为 ```film-pull JSON：在同一对象内填写 meta、shootingPrep、shots（含 cutDetail）以及 narrativeLogic / beatPoints / replicableShootingScript。禁止 Markdown 表格或前言。";

export function buildFilmPullRenderScriptUserPrompt(opts: {
  analyzeJson: string;
  characterDescription: string;
  characterRefLabels: string[];
}): string {
  const refs =
    opts.characterRefLabels.length > 0
      ? opts.characterRefLabels.map((l, i) => `角色参考图${i + 1}：${l}`).join("\n")
      : "（无参考图，仅文字人设）";
  return appendFilmPullJsonDeliveryFooter(`## 拉片 JSON

${opts.analyzeJson}

## 新角色设定

${opts.characterDescription.trim() || "按参考图统一替换原片人物"}

${refs}

请输出 render_script_complete（\`\`\`film-pull JSON only）。`);
}
