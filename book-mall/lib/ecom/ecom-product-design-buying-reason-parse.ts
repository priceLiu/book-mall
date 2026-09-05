import type { ProductDesign } from "@/lib/ecom/ecom-product-design-types";
import { stripProductDesignFence } from "@/lib/ecom/ecom-product-design-display";
import { sanitizeStep3MiddleMarkdown } from "@/lib/ecom/ecom-product-design-middle-sanitize";

function normalizeStepText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\*\*/g, "")
    .trim();
}

export function normalizeMatrixCell(text: string): string {
  return normalizeStepText(text).replace(/\|/g, "｜");
}

/** @deprecated 旧五列矩阵，读取时回落 */
export type BuyingReasonMatrixRow = {
  sellingPoint: string;
  physicalDesc: string;
  reason: string;
  emotionalValue: string;
};

export type BuyingReasonTable = {
  headers: string[];
  rows: string[][];
};

export type BuyingReasonBrief = NonNullable<ProductDesign["buyingReasonBrief"]>;

function isSeparatorRow(row: string[]): boolean {
  return row.every((c) => /^:?-+:?$/.test(c.trim()));
}

function parseTableCells(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((c) => normalizeMatrixCell(c.trim()));
}

function isIndexHeader(label: string): boolean {
  return /^#$|^序号$|^编号$|^No\.?$/i.test(label.trim());
}

function isArrowHeader(label: string): boolean {
  return /^→|->|^[-→]+$/i.test(label.trim());
}

function padRow(row: string[], colCount: number): string[] {
  const cells = [...row];
  while (cells.length < colCount) cells.push("");
  return cells.slice(0, colCount);
}

function tableQualityScore(table: BuyingReasonTable | null | undefined): number {
  if (!isValidStep3Table(table)) return 0;
  let score = table!.rows.length * table!.headers.length;
  for (const row of table!.rows) {
    for (const cell of row) {
      if (cell.trim().length > 4) score += 1;
    }
  }
  if (table!.headers.some((h) => /购买理由/.test(h))) score += 5;
  if (table!.headers.some((h) => /用户痛点|产品卖点/.test(h))) score += 3;
  return score;
}

/** Step2 营销总表（方案序号 | 方案名称 | 切入逻辑 …）— 不得当作 Step3 */
export function isMarketingPlanSummaryTable(headers: string[]): boolean {
  if (headers.length === 0) return false;
  const joined = headers.join("|");
  if (/方案名称/.test(joined) && /切入/.test(joined)) return true;
  if (/方案序号|方案编号/.test(joined) && /方案名称/.test(joined)) return true;
  const marketingDims = headers.filter((h) =>
    /击中痛点|用户收获|视觉情绪|主图情绪|切入逻辑|方案名称|方案序号/.test(h),
  ).length;
  return marketingDims >= 2;
}

/** 真正的 Step3 卖点→购买理由表（须含购买理由列，或产品卖点矩阵） */
export function isValidStep3Table(table: BuyingReasonTable | null | undefined): boolean {
  if (!table?.headers.length || !table.rows.length) return false;
  if (isMarketingPlanSummaryTable(table.headers)) return false;
  if (table.headers.some((h) => /购买理由|Why Buy/i.test(h))) return true;
  const hasSelling = table.headers.some((h) => /产品卖点|^卖点$/.test(h));
  const hasUserPain = table.headers.some((h) => /用户痛点/.test(h));
  return hasSelling && (hasUserPain || table.headers.some((h) => /物理|功能|情绪/.test(h)));
}

export function chatHistoryHasStep3AdvanceRequest(
  chatHistory: Array<{ role: string; content: string }>,
): boolean {
  for (const m of chatHistory) {
    if (m.role !== "user") continue;
    if (/请执行 Step3|Step3：将卖点|Step3:将卖点/i.test(m.content)) return true;
  }
  return false;
}

/** Step3 已解锁：助手区已点「下一步」推进，或库内已有合法 Step3 定稿 */
export function isStep3Unlocked(project: {
  design: ProductDesign | null;
  chatHistory: Array<{ role: string; content: string }>;
}): boolean {
  if (project.design?.selectedPlanNo == null) return false;
  const storedTable = resolveBuyingReasonTable(project.design?.buyingReasonBrief);
  if (isValidStep3Table(storedTable)) {
    if (project.design?.buyingReasonBrief?.userEdited) return true;
    if (chatHistoryHasStep3AdvanceRequest(project.chatHistory)) return true;
    if ((project.design?.buyingReasons?.length ?? 0) > 0) return true;
  }
  return chatHistoryHasStep3AdvanceRequest(project.chatHistory);
}

/** 与会话区一致：保留 Markdown 表格原始列名与单元格 */
export function parseBuyingReasonTableFromMarkdown(text: string): BuyingReasonTable | null {
  const lines = stripProductDesignFence(text).split("\n");
  const tableBlocks: string[][][] = [];
  let current: string[][] = [];

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("|") && t.endsWith("|")) {
      current.push(parseTableCells(t));
      continue;
    }
    if (current.length > 0) {
      tableBlocks.push(current);
      current = [];
    }
  }
  if (current.length > 0) tableBlocks.push(current);

  let best: BuyingReasonTable | null = null;
  let bestScore = 0;

  for (const block of tableBlocks) {
    const dataRows = block.filter((r) => !isSeparatorRow(r));
    if (dataRows.length < 2) continue;

    const rawHead = dataRows[0]!.map((c) => c.trim());
    const head = rawHead.filter((h, i) => h && !isArrowHeader(h));
    const headIndices = rawHead
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => h && !isArrowHeader(h))
      .map(({ i }) => i);

    const isStep3Table =
      !isMarketingPlanSummaryTable(head) &&
      (head.some((h) => /购买理由|Why Buy/i.test(h)) ||
        (head.some((h) => /产品卖点|^卖点$/.test(h)) &&
          head.some((h) => /用户痛点|物理|功能|情绪|硬核/.test(h))));
    if (!isStep3Table) continue;

    const colCount = head.length;
    const rows: string[][] = [];
    for (const row of dataRows.slice(1)) {
      const cells = headIndices.map((i) => normalizeMatrixCell(row[i] ?? ""));
      if (cells.every((c) => !c.trim() || c === "—" || c === "-")) continue;
      if (cells.filter((c) => c.trim()).length === 0) continue;
      rows.push(padRow(cells, colCount));
    }

    if (rows.length === 0) continue;

    const table: BuyingReasonTable = { headers: head, rows };
    if (!isValidStep3Table(table)) continue;
    const score = tableQualityScore(table);
    if (score > bestScore) {
      bestScore = score;
      best = table;
    }
  }

  return best;
}

/** 旧 matrix → 动态 table（兼容历史数据） */
export function tableFromLegacyMatrix(matrix: BuyingReasonMatrixRow[]): BuyingReasonTable | null {
  if (matrix.length === 0) return null;
  const hasPhysical = matrix.some((r) => r.physicalDesc.trim());
  const hasEmotion = matrix.some((r) => r.emotionalValue.trim());
  const headers = ["产品卖点"];
  if (hasPhysical) headers.push("物理功能描述");
  headers.push("用户购买理由");
  if (hasEmotion) headers.push("情绪价值");

  const rows = matrix.map((r) => {
    const cells = [r.sellingPoint];
    if (hasPhysical) cells.push(r.physicalDesc);
    cells.push(r.reason);
    if (hasEmotion) cells.push(r.emotionalValue);
    return cells;
  });

  return { headers, rows };
}

export function resolveBuyingReasonTable(brief: BuyingReasonBrief | null | undefined): BuyingReasonTable | null {
  if (!brief) return null;
  if (brief.table?.headers.length && brief.table.rows.length) {
    return {
      headers: brief.table.headers,
      rows: brief.table.rows.map((r) => padRow(r, brief.table!.headers.length)),
    };
  }
  if (brief.matrix?.length) return tableFromLegacyMatrix(brief.matrix);
  return null;
}

export function findReasonColumnIndex(headers: string[]): number {
  const idx = headers.findIndex((h) => /购买理由|Why Buy/i.test(h));
  if (idx >= 0) return idx;
  return headers.length > 0 ? headers.length - 1 : -1;
}

export function deriveBuyingReasonsFromBrief(brief: BuyingReasonBrief | null | undefined): string[] {
  const table = resolveBuyingReasonTable(brief);
  if (!table) return [];

  const reasonIdx = findReasonColumnIndex(table.headers);
  if (reasonIdx < 0) return [];

  return table.rows
    .map((row) => row[reasonIdx]?.trim() ?? "")
    .filter(Boolean);
}

function extractStep3Intro(sectionMarkdown: string): string {
  const lines = sectionMarkdown.split("\n");
  const introLines: string[] = [];
  let started = false;

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("|")) break;
    if (/^#{1,4}\s*Step\s*3/i.test(t)) {
      started = true;
      continue;
    }
    if (/^#{1,4}\s*1\.\s*卖点转化矩阵/i.test(t)) continue;
    if (/^#{1,4}\s/.test(t) && !/Step\s*3/i.test(t)) continue;
    if (!started && !/基于|购买理由|卖点转/.test(t)) continue;
    if (t) introLines.push(t);
  }

  return normalizeStepText(introLines.join("\n").trim());
}

export function extractStep3DisplayMarkdown(text: string): string {
  const stripped = stripProductDesignFence(text);
  if (!stripped.trim()) return "";

  const endPattern = /\n#{1,3}\s*Step\s*4|\n```\s*product-design/i;
  const idx = stripped.search(/Step\s*3|卖点转.*购买理由|购买理由/i);
  if (idx >= 0) {
    const slice = stripped.slice(idx);
    const end = slice.search(endPattern);
    const section = (end >= 0 ? slice.slice(0, end) : slice).trim();
    if (/\|/.test(section)) return section;
  }
  return "";
}

export function buildBuyingReasonBriefFromMarkdown(text: string): BuyingReasonBrief | null {
  const table = parseBuyingReasonTableFromMarkdown(text);
  const section = extractStep3DisplayMarkdown(text);
  const intro = section ? extractStep3Intro(section) : "";

  if (!isValidStep3Table(table) && !intro.trim()) return null;
  if (!isValidStep3Table(table) && intro.trim() && !/Step\s*3|购买理由|卖点转/.test(text)) {
    return null;
  }

  return {
    intro,
    matrix: [],
    table: table ?? { headers: [], rows: [] },
    displayMarkdown: section ? sanitizeStep3MiddleMarkdown(section) : undefined,
  };
}

function buyingReasonBriefQualityScore(brief: BuyingReasonBrief | null | undefined): number {
  if (!brief) return 0;
  let score = tableQualityScore(resolveBuyingReasonTable(brief));
  if (brief.intro && brief.intro.length > 20) score += 2;
  if (brief.userEdited) score += 20;
  return score;
}

export function coalesceBuyingReasonFromText(
  prevBrief: BuyingReasonBrief | null | undefined,
  fromJsonReasons: string[] | undefined,
  markdownText: string,
): { brief: BuyingReasonBrief | null; reasons: string[] } {
  const fromMd = buildBuyingReasonBriefFromMarkdown(markdownText);
  const jsonReasons = (fromJsonReasons ?? []).filter((r) => r.trim());

  let brief: BuyingReasonBrief | null = prevBrief ?? null;

  if (prevBrief?.userEdited) {
    brief = prevBrief;
  } else if (fromMd && isValidStep3Table(fromMd.table)) {
    if (!brief || buyingReasonBriefQualityScore(fromMd) >= buyingReasonBriefQualityScore(brief)) {
      brief = {
        intro: fromMd.intro || brief?.intro || "",
        matrix: [],
        table: fromMd.table,
        displayMarkdown: fromMd.displayMarkdown || brief?.displayMarkdown,
        userEdited: false,
      };
    }
  }

  const mdReasons = deriveBuyingReasonsFromBrief(brief);
  const reasons =
    brief?.userEdited && mdReasons.length > 0
      ? mdReasons
      : [mdReasons, jsonReasons, deriveBuyingReasonsFromBrief(prevBrief)]
          .sort((a, b) => b.length - a.length)
          .find((list) => list.length > 0) ?? [];

  return { brief, reasons };
}

export function findStep3AssistantText(
  chatHistory: Array<{ role: string; content: string }>,
  fallbackRaw = "",
): string {
  let best = "";
  let bestScore = 0;

  for (const m of chatHistory) {
    if (m.role !== "assistant") continue;
    const table = parseBuyingReasonTableFromMarkdown(m.content);
    if (!isValidStep3Table(table)) continue;
    const markerBonus = /Step\s*3|卖点转.*购买理由|购买理由矩阵/i.test(m.content) ? 20 : 0;
    const score = tableQualityScore(table) + markerBonus;
    if (score > bestScore) {
      bestScore = score;
      best = m.content;
    }
  }

  if (best) return best;
  if (fallbackRaw.trim()) return fallbackRaw;
  const last = [...chatHistory].reverse().find((m) => m.role === "assistant");
  return last?.content ?? "";
}

export type BuyingReasonDisplay = {
  brief: BuyingReasonBrief | null;
  table: BuyingReasonTable | null;
  intro: string;
  reasons: string[];
  hasContent: boolean;
};

const EMPTY_BUYING_REASON_DISPLAY: BuyingReasonDisplay = {
  brief: null,
  table: null,
  intro: "",
  reasons: [],
  hasContent: false,
};

/** 展示用：与会话区同源；须选定方案且在助手区点「下一步」推进 Step3 后才展示 */
export function resolveBuyingReasonForDisplay(project: {
  design: ProductDesign | null;
  chatHistory: Array<{ role: string; content: string }>;
}): BuyingReasonDisplay {
  if (!isStep3Unlocked(project)) {
    return EMPTY_BUYING_REASON_DISPLAY;
  }

  const storedBrief = project.design?.buyingReasonBrief ?? null;
  const storedReasons = project.design?.buyingReasons ?? [];
  const step3Text = findStep3AssistantText(project.chatHistory);
  const fromChat = buildBuyingReasonBriefFromMarkdown(step3Text);

  let brief: BuyingReasonBrief | null = storedBrief;

  // stored 优先：库内已有有效 Step3 表就直接用，聊天仅在库空时兜底
  if (!storedBrief?.userEdited && !hasBuyingReasonBriefContent(storedBrief) && fromChat) {
    brief = {
      intro: fromChat.intro || storedBrief?.intro || "",
      matrix: [],
      table: fromChat.table,
      displayMarkdown: fromChat.displayMarkdown || storedBrief?.displayMarkdown,
      userEdited: false,
    };
  }

  const table = resolveBuyingReasonTable(brief);
  const intro = brief?.intro?.trim() ?? fromChat?.intro?.trim() ?? "";

  const fromBriefReasons = deriveBuyingReasonsFromBrief(brief);
  const reasons =
    brief?.userEdited && fromBriefReasons.length > 0
      ? fromBriefReasons
      : fromBriefReasons.length >= storedReasons.length
        ? fromBriefReasons
        : storedReasons;

  const hasContent = isValidStep3Table(table);

  return { brief, table: isValidStep3Table(table) ? table : null, intro, reasons, hasContent };
}

export function hasBuyingReasonBriefContent(
  brief: BuyingReasonBrief | null | undefined,
): boolean {
  return isValidStep3Table(resolveBuyingReasonTable(brief));
}

/** Step3 已完成（库内定稿），用于 Step4+ 下游门控 */
export function isStep3Complete(
  design: ProductDesign | null | undefined,
): boolean {
  return (
    hasBuyingReasonBriefContent(design?.buyingReasonBrief) ||
    (design?.buyingReasons?.length ?? 0) > 0
  );
}

/** 中间区 / 落库：Step3 已定稿，或已解锁且会话中有合法 Step3 表 */
export function isStep3ReadyForDownstream(project: {
  design: ProductDesign | null;
  chatHistory: Array<{ role: string; content: string }>;
}): boolean {
  if (isStep3Complete(project.design)) return true;
  if (!isStep3Unlocked(project)) return false;
  const table = parseBuyingReasonTableFromMarkdown(
    findStep3AssistantText(project.chatHistory),
  );
  return isValidStep3Table(table);
}

export function buildBuyingReasonBriefPatch(
  prev: BuyingReasonBrief | null | undefined,
  table: BuyingReasonTable,
  intro?: string,
): BuyingReasonBrief {
  return {
    intro: intro ?? prev?.intro ?? "",
    matrix: [],
    table,
    displayMarkdown: prev?.displayMarkdown,
    userEdited: true,
  };
}

/** @deprecated 供旧代码引用 */
export function parseBuyingReasonMatrixFromMarkdown(text: string): BuyingReasonMatrixRow[] {
  const table = parseBuyingReasonTableFromMarkdown(text);
  if (!table) return [];
  const spIdx = table.headers.findIndex((h) => /卖点/.test(h));
  const pdIdx = table.headers.findIndex((h) => /物理|功能/.test(h));
  const rsIdx = findReasonColumnIndex(table.headers);
  const emIdx = table.headers.findIndex((h) => /情绪/.test(h));
  return table.rows.map((row) => ({
    sellingPoint: spIdx >= 0 ? (row[spIdx] ?? "") : (row[0] ?? ""),
    physicalDesc: pdIdx >= 0 ? (row[pdIdx] ?? "") : "",
    reason: rsIdx >= 0 ? (row[rsIdx] ?? "") : "",
    emotionalValue: emIdx >= 0 ? (row[emIdx] ?? "") : "",
  }));
}
