import {
  HAND_CRAFT_STEPS,
  type HandCraftStepDef,
  type HandCraftStepId,
} from "@/lib/ecom/ecom-hand-craft-steps";

/**
 * 解析助手输出。助手只负责话术与「微调本步」，因此这里只认两件事：
 * 1. 当前进行到第几步 → 写回 meta.workflow.currentStepId
 * 2. 槽位调整表 → 覆盖本步槽位的名称与画面说明
 */

/** 从文本里认出助手正在讲第几步：先认「第 N 步」，再退回步骤名 */
export function detectHandCraftStep(text: string): HandCraftStepDef | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const byNo = trimmed.match(/第\s*(\d{1,2})\s*步/);
  if (byNo) {
    const no = Number(byNo[1]);
    const hit = HAND_CRAFT_STEPS.find((s) => s.no === no);
    if (hit) return hit;
  }

  // 取最后一次出现的步骤名：助手常先回顾上一步再讲当前步
  let best: { step: HandCraftStepDef; at: number } | null = null;
  for (const step of HAND_CRAFT_STEPS) {
    const at = trimmed.lastIndexOf(step.label);
    if (at >= 0 && (!best || at > best.at)) best = { step, at };
  }
  return best?.step ?? null;
}

export type HandCraftSlotOverride = {
  index: number;
  title?: string;
  prompt?: string;
};

const TABLE_ROW = /^\|(.+)\|\s*$/;

function splitRow(line: string): string[] {
  const m = line.match(TABLE_ROW);
  if (!m) return [];
  return m[1]!.split("|").map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

/**
 * 解析槽位调整表。约定表头含「序号」，其后依次为名称与画面说明：
 *
 * | 序号 | 名称 | 画面说明 |
 * | --- | --- | --- |
 * | 1 | 甜点主题 | 换成草莓奶油配色，其余不变 |
 */
export function parseHandCraftSlotOverrides(
  markdown: string,
  step: HandCraftStepDef,
): HandCraftSlotOverride[] {
  const lines = markdown.split("\n");
  const validIndexes = new Set(step.slots.map((s) => s.index));
  const out = new Map<number, HandCraftSlotOverride>();

  let inTable = false;
  let cols: { index: number; title: number; prompt: number } | null = null;

  for (const line of lines) {
    const cells = splitRow(line.trim());
    if (cells.length === 0) {
      inTable = false;
      cols = null;
      continue;
    }
    if (isSeparatorRow(cells)) continue;

    if (!inTable) {
      const indexAt = cells.findIndex((c) => /序号|编号|槽位|#/.test(c));
      if (indexAt < 0) continue;
      const titleAt = cells.findIndex((c) => /名称|标题|主题|用途/.test(c));
      const promptAt = cells.findIndex((c) => /说明|画面|描述|Prompt/i.test(c));
      if (titleAt < 0 && promptAt < 0) continue;
      inTable = true;
      cols = { index: indexAt, title: titleAt, prompt: promptAt };
      continue;
    }

    if (!cols) continue;
    const rawIndex = cells[cols.index] ?? "";
    const index = Number(rawIndex.replace(/[^\d]/g, ""));
    if (!Number.isInteger(index) || !validIndexes.has(index)) continue;

    const title = cols.title >= 0 ? cells[cols.title]?.trim() : undefined;
    const prompt = cols.prompt >= 0 ? cells[cols.prompt]?.trim() : undefined;
    if (!title && !prompt) continue;

    out.set(index, {
      index,
      title: title || undefined,
      prompt: prompt || undefined,
    });
  }

  return [...out.values()].sort((a, b) => a.index - b.index);
}

export type HandCraftSyncResult = {
  stepId: HandCraftStepId | null;
  overrides: HandCraftSlotOverride[];
};

export function parseHandCraftAssistantOutput(markdown: string): HandCraftSyncResult {
  const step = detectHandCraftStep(markdown);
  if (!step) return { stepId: null, overrides: [] };
  return {
    stepId: step.id,
    overrides: step.kind === "generate" ? parseHandCraftSlotOverrides(markdown, step) : [],
  };
}
