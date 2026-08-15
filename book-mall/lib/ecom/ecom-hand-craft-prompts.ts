import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  HAND_CRAFT_STEPS,
  type HandCraftStepDef,
} from "@/lib/ecom/ecom-hand-craft-steps";

const SKILL_PATH = resolve(__dirname, "../../doc/手伴/skill.md");

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

function stepProgressLines(opts: {
  readySteps: string[];
  currentStep: HandCraftStepDef | null;
}): string[] {
  const ready = new Set(opts.readySteps);
  return HAND_CRAFT_STEPS.map((step) => {
    const mark = ready.has(step.id) ? "已完成" : step.id === opts.currentStep?.id ? "进行中" : "未开始";
    return `- 第 ${step.no} 步 ${step.label}：${mark}`;
  });
}

export function buildHandCraftSystemPrompt(opts: {
  sketchCount: number;
  readySteps: string[];
  currentStepId: string | null;
}): string {
  const skill = loadSkillMd();
  const currentStep =
    HAND_CRAFT_STEPS.find((s) => s.id === opts.currentStepId) ?? null;

  return `${skill}

---

## 运行时上下文（界面已就绪，勿重复追问）
- 已上传线稿：${opts.sketchCount} 张
- 当前步骤：${currentStep ? `第 ${currentStep.no} 步 ${currentStep.label}` : "尚未开始"}
- 各步进度：
${stepProgressLines({ readySteps: opts.readySteps, currentStep }).join("\n")}

## 界面交互规则
- 出图与拼版都由中间工作区执行，你**不生成图片**：你的职责是发本步话术、解释锁定规则、按用户反馈调整本步槽位说明。
- 用户通过点选按钮回复，**不要**要求用户输入编号。
- 每步结束后必须暂停等待用户确认，禁止一次性输出后续步骤。
- 用户确认某步后，请回一句「已交给工作区生成，请在中间区点击生成」并说明本步会产出几张图。
- 只输出 Markdown，禁止输出 JSON 或代码围栏内的结构化交付物。
- 用户上传新线稿时，提示流程将重置回第 1 步，旧素材不再复用。

## 微调本步时的固定输出格式
用户要求调整当前步骤（换主题、改配色、增删条目）时，除说明文字外，**必须**附一张调整表，工作区会据此改写本步槽位：

| 序号 | 名称 | 画面说明 |
| --- | --- | --- |
| 1 | 甜点主题 | 换成草莓奶油配色，其余保持不变 |

- 序号必须对应本步已有槽位编号，不要新增不存在的序号。
- 画面说明只写本槽差异，不要重复基准风格串（系统会自动拼接）。
- 每次回复最多一张调整表；不涉及调整时不要输出该表。`;
}
