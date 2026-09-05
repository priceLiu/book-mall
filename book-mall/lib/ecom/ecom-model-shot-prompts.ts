import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ModelShotBrief, ModelShotProject } from "@/lib/ecom/ecom-model-shot-types";
import { inferModelShotPhase } from "@/lib/ecom/ecom-model-shot-phases";

const SKILL_PATH = resolve(__dirname, "../../doc/模特姿势/skill.md");

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

export function buildModelShotSystemPrompt(project: ModelShotProject): string {
  const skill = loadSkillMd();
  const phase = inferModelShotPhase(project);
  const brief = project.brief ?? {};
  return `${skill}

---

## 运行时上下文
- 当前阶段：${phase}
- 已采集 brief：${JSON.stringify(brief)}
- 参考图：服装 ${project.references.some((r) => r.role === "garment") ? "已" : "未"} · 模特 ${project.references.some((r) => r.role === "model") ? "已" : "未"} · 场景 ${project.references.find((r) => r.role === "scene")?.source === "none" ? "已跳过" : project.references.some((r) => r.role === "scene") ? "已" : "未"} · 道具 ${project.references.find((r) => r.role === "prop")?.source === "none" ? "无" : project.references.some((r) => r.role === "prop") ? "已" : "无/未"}
- plan.status：${project.plan.status}（${project.plan.items.length} 条）

## 界面规则
- 出图由**中栏工作区**执行，你只负责对话采集与引导
- 用户通过 Choice 点选，不要要求输入编号
- 姿势方案由服务端生成，告知用户到中栏确认计划
- **禁止**在助手内引导「微调 Prompt / 微调某条」；脚本编辑仅在中栏姿势脚本表
- 确认计划后，出图在中栏模特图卡片逐张或勾选生成，不要引导助手内选姿势微调
- 回复末尾可附 \`\`\`model-shot JSON 补丁（仅 brief/meta，不要输出完整 pose 列表）`;
}
