import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { IP_MASTER_STEPS } from "@/lib/ecom/ecom-ip-master-steps";

const SKILL_PATH = resolve(
  process.cwd(),
  "../docs/IP母版 skill.md",
);

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

export function buildIpMasterSystemPrompt(opts: {
  benchmarkCount: number;
  hasBrief: boolean;
  currentStepId: string | null;
  draftMarkdown?: string;
}): string {
  const skill = loadSkillMd();
  const step =
    IP_MASTER_STEPS.find((s) => s.id === opts.currentStepId) ??
    IP_MASTER_STEPS[0]!;

  return `${skill}

---

## 运行时上下文
- 已上传基准图：${opts.benchmarkCount} 张
- 已填写文字描述：${opts.hasBrief ? "是" : "否"}
- 当前逻辑步：第 ${step.no} 步 ${step.label}
- 草稿模板：${opts.draftMarkdown?.trim() ? "已有（用户可在中栏编辑）" : "尚无"}

## 界面规则
- 你不直接保存版本：用户在中栏编辑 Markdown 后点「保存版本」。
- 解析模板时输出完整「【IP角色结构化模板】」Markdown 块；缺失信息标「待补充」，禁止编造。
- 只输出 Markdown，禁止 JSON 代码块作为交付物。
- 进度轨任意步可点，勿要求用户逐步解锁。
`;
}
