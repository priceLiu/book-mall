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

const FILM_PULL_FENCE_CONTRACT = `
## 【强制 · 机器校验】\`\`\`film-pull JSON 契约

系统**只解析**回复**最末尾**唯一围栏 \`\`\`film-pull。

### 填写顺序（不可打乱）
1. **先**在 JSON 中完整填写 \`meta\`、\`shootingPrep\`、\`shots[]\`（含每镜 cutDetail）；
2. 再写 Markdown：分镜总览表 + shootingPrep + meta 摘要；
3. 再写三块**总结性长文**（\`narrativeLogic\` / \`beatPoints\` / \`replicableShootingScript\`），须与 JSON 一致、不得超集；
4. **最后一行起**输出唯一 \`\`\`film-pull JSON。

### 类型与必填
| 字段 | 类型 | 规则 |
|------|------|------|
| schemaVersion | number | 固定 \`1\` |
| action | string | \`analyze_complete\` |
| meta.totalDurationSec | number | 与末镜 endTimeSec 一致（≤${FILM_PULL_V1_MAX_SEC}s） |
| meta 其余 6 项 | string | 非空；全片节奏/色彩/运镜/声音须写入 meta，不可只在 beatPoints 长文 |
| shootingPrep | object | venue / costume / props / equipment 四字段非空；**venue 禁止「无」** |
| narrativeLogic / beatPoints / replicableShootingScript | string | **总结性长文**，必填，与 JSON 真源一致 |
| shots | array | 每镜 25 维 + **cutDetail** + audioInfo |
| cutTransition | string | 仅类型：硬切/叠化/闪白… |
| cutDetail | string | 入出点/动作切点；**非末镜禁止「无」** |
| sceneEnvironment 等 | string | 非空；**多数镜禁止「无」**（见 skill.md） |

### 镜序与时间
- 每次硬切 = 一镜；shotNo 从 1 递增；时间字段为 number

完整示例见 table-format.md。语法或结构化质量校验失败 → 整次拉片失败并重试。
`;

/** 校验失败重试（语法或质量） */
export function buildFilmPullAnalyzeRetryUserPrompt(reason: string): string {
  return `上次输出未通过校验：${reason}

请**仅**重输出完整 \`\`\`film-pull 围栏（可省略 Markdown 前言），并严格遵守：
1. 先填 meta、shootingPrep、shots（含 cutDetail），再写三块总结长文；
2. shootingPrep.venue 非「无」；多数镜 sceneEnvironment / subjectBlocking / lightingSetup 须有可观测内容；
3. 非末镜 cutDetail 写动作切点；beatPoints 中的切点须在 cutDetail 出现；
4. 【准备】场地/服装/道具/设备 → shootingPrep；本镜道具 → dynamicProps；
5. schemaVersion=1、时间为 number、每镜 audioInfo 四字段、禁止尾逗号。`;
}

export function buildFilmPullAnalyzeSystemPrompt(): string {
  const skill = loadSkillMd().trim();
  const table = loadTableMd().trim();
  return [skill, FILM_PULL_FENCE_CONTRACT, table].filter(Boolean).join("\n\n---\n\n");
}

export function buildFilmPullRenderScriptSystemPrompt(): string {
  return `${buildFilmPullAnalyzeSystemPrompt()}

## 当前任务 · render_script_complete

你将收到完整拉片 JSON 与新角色设定（含参考图描述）。
- 镜数、时间、转场、cutDetail、shootingPrep、场景、光影、audioInfo 全部继承；
- 只替换人物相关：subjectBlocking、sightDirection、aiVisualPrompt；
- 必须输出 renderGlobalConfig；
- action 固定 render_script_complete。`;
}

export const FILM_PULL_DEFAULT_ANALYZE_USER_PROMPT =
  "请对我上传的这段视频做逐镜全维度专业拉片。先完整填写 JSON 真源（meta、shootingPrep、shots 含 cutDetail），再输出 narrativeLogic / beatPoints / replicableShootingScript 三块总结（须与 JSON 一致），末尾唯一 ```film-pull JSON。";

export function buildFilmPullRenderScriptUserPrompt(opts: {
  analyzeJson: string;
  characterDescription: string;
  characterRefLabels: string[];
}): string {
  const refs =
    opts.characterRefLabels.length > 0
      ? opts.characterRefLabels.map((l, i) => `角色参考图${i + 1}：${l}`).join("\n")
      : "（无参考图，仅文字人设）";
  return `## 拉片 JSON

${opts.analyzeJson}

## 新角色设定

${opts.characterDescription.trim() || "按参考图统一替换原片人物"}

${refs}

请输出 render_script_complete JSON。`;
}
