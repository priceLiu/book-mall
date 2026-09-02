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

系统**只解析**回复**最末尾**唯一围栏 \`\`\`film-pull（禁止 \`\`\`json / \`\`\`media-decompose / 多个围栏 / 围栏外再跟文字）。

### 输出顺序（不可打乱）
1. 用户可读 Markdown：分镜总览表 + meta 摘要 + narrativeLogic / beatPoints / replicableShootingScript 三块长文；
2. **最后一行起**输出唯一 \`\`\`film-pull JSON（须可被 \`JSON.parse\` 直接解析）。

### 类型与必填（违反即失败）
| 字段 | 类型 | 规则 |
|------|------|------|
| schemaVersion | number | 固定 \`1\`（禁止 \`"1"\` 字符串） |
| action | string | analyze 固定 \`analyze_complete\` |
| meta.totalDurationSec | number | 秒，与视频实际时长一致（≤${FILM_PULL_V1_MAX_SEC}s） |
| meta 其余 6 项 | string | **非空**；无内容写 \`"无"\`，禁止 \`""\` / \`null\` |
| narrativeLogic / beatPoints / replicableShootingScript | string | **非空**长文；与 Markdown 三块一致 |
| shots | array | 至少 1 镜；每镜 25 维字段齐全 |
| shotNo / startTimeSec / endTimeSec / durationSec | number | **禁止引号字符串**；durationSec = endTimeSec − startTimeSec（误差 ≤0.02s） |
| shots 内各 string 维 | string | **非空**；无内容写 \`"无"\` |
| audioInfo | object | **每镜必须有**；含 scriptSubtitle / vocalEmotion / ambientSound / fxAndBgm 四个 **非空** string |

### JSON 语法（禁止）
- 注释（\`//\` \`/* */\`）
- 尾逗号（\`,}\` \`,]\`）
- 单引号、中文弯引号
- 把 number 写成 \`"3.5"\` 字符串
- 省略 audioInfo 或把口播写在镜级 voiceover 而不写入 audioInfo.scriptSubtitle

### 镜序与时间
- 每次硬切/转场 = 一镜；shotNo 从 1 递增
- 首镜 startTimeSec = 0；末镜 endTimeSec ≈ meta.totalDurationSec

完整字段示例见 table-format.md。缺围栏、JSON 非法、必填缺失、类型错误 → **整次拉片失败**。
`;

/** 校验失败重试时附带给模型的硬性修正清单 */
export function buildFilmPullAnalyzeRetryUserPrompt(parseError: string): string {
  return `上次输出未通过机器校验：${parseError}

请**仅**重输出一个完整、可直接 JSON.parse 的 \`\`\`film-pull 围栏（可省略 Markdown 前言），并严格遵守：
1. schemaVersion=1（number）、action=analyze_complete；
2. meta.totalDurationSec 与 shots 末镜 endTimeSec 一致（number）；
3. 所有 string 字段非空，无内容写「无」；
4. shotNo/startTimeSec/endTimeSec/durationSec 全部为 number，禁止字符串；
5. 每镜必须有 audioInfo 四字段（口播写入 scriptSubtitle）；
6. 禁止尾逗号、注释、\`\`\`json 标签。`;
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
- 镜数、startTimeSec、endTimeSec、durationSec、转场、场景、光影、audioInfo 全部继承；
- 只替换人物相关：subjectBlocking、sightDirection、aiVisualPrompt；
- 必须输出 renderGlobalConfig；
- action 固定 render_script_complete。`;
}

export const FILM_PULL_DEFAULT_ANALYZE_USER_PROMPT =
  "请对我上传的这段视频做逐镜全维度专业拉片。严格按 skill 与 table-format 输出 Markdown + 末尾唯一 ```film-pull JSON；所有 string 非空（无内容写「无」），时间字段用 number，每镜含完整 audioInfo。";

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
