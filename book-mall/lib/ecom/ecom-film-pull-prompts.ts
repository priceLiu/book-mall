import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
## 【强制】机器可读交付 · \`\`\`film-pull JSON

1. 先写用户可读 Markdown（分镜总览表 + meta 摘要 + 整体叙事逻辑 / 镜头卡点要点 / 可复刻拍摄脚本 三块）；
2. **最末尾**唯一围栏 \`\`\`film-pull；
3. JSON 须含 narrativeLogic、beatPoints、replicableShootingScript（与 Markdown 三块一致）；
4. JSON 禁止注释、尾逗号。

契约见 table-format.md。
`;

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
  "请对我上传的这段视频做逐镜全维度专业拉片，严格按 skill 与 table-format 输出。";

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
