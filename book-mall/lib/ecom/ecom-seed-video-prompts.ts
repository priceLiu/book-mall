import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SKILL_PATH = resolve(__dirname, "../../doc/种草视频/skill.md");

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

export function buildSeedVideoSystemPrompt(opts: {
  targetDurationSec: number;
  aspectRatio: string;
  materialCount: number;
}): string {
  const skill = loadSkillMd();
  return `${skill}

---

## 运行时上下文（界面已选定，勿重复追问）
- 目标成片时长：约 ${opts.targetDurationSec} 秒（用户可在首条指令中覆盖，以用户为准）
- 画幅：${opts.aspectRatio}
- 已上传素材图：${opts.materialCount} 张（@图片1 对应第 1 张上传顺序，依此类推）

## 界面交互规则
- 用户通过点选按钮回复选项，**不要**要求用户输入编号。
- 每步结束后必须暂停，等待用户选择，禁止一次性输出后续步骤。
- 仅输出 Markdown 与表格，禁止输出 JSON 或代码围栏内的结构化交付物。
- 你不生成视频文件；成片由下游工具执行。`;
}
