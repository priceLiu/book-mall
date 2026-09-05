import {
  coalesceBuyingReasonFromText,
  deriveBuyingReasonsFromBrief,
  hasBuyingReasonBriefContent,
} from "@/lib/ecom/ecom-product-design-buying-reason-parse";
import {
  coalesceAnalysisFromText,
  coalesceDetailOutlineFromText,
  coalesceMainImagesFromText,
} from "@/lib/ecom/ecom-product-design-step-sync-parse";
import type { ProductDesign } from "@/lib/ecom/ecom-product-design-types";
import { stripProductDesignFence } from "@/lib/ecom/ecom-product-design-display";

export type MarketingPlanRow = { label: string; content: string };
export type MarketingPlan = ProductDesign["marketingPlans"][number];

export const MARKETING_PLAN_DIMENSIONS = [
  { key: "angle" as const, label: "切入逻辑" },
  { key: "painPoint" as const, label: "击中痛点" },
  { key: "outcome" as const, label: "用户收获" },
  { key: "mood" as const, label: "情绪风格" },
];

const PLAN_CN = ["一", "二", "三"] as const;

export function marketingPlanDisplayNo(no: number): string {
  return PLAN_CN[no - 1] ?? String(no);
}

function planNoFromLabel(label: string, fallback: number): number {
  if (/方案\s*[一1Aa]|^A$/i.test(label)) return 1;
  if (/方案\s*[二2Bb]|^B$/i.test(label)) return 2;
  if (/方案\s*[三3Cc]|^C$/i.test(label)) return 3;
  const m = label.match(/方案\s*([ABCabc123])/);
  if (!m?.[1]) return fallback;
  const ch = m[1].toUpperCase();
  if (ch === "A" || ch === "1") return 1;
  if (ch === "B" || ch === "2") return 2;
  if (ch === "C" || ch === "3") return 3;
  const n = Number.parseInt(ch, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function stripMdBold(text: string): string {
  return text.replace(/\*\*/g, "").trim();
}

/** 解析单元格：`<br>` → 换行，去掉其余 HTML 标签 */
export function normalizeMarketingPlanText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\*\*/g, "")
    .trim();
}

export function isPlanNumberDimensionLabel(label: string): boolean {
  return /^方案编号$|^编号$|^序号$|^#$/i.test(label.trim());
}

function filterPlanRows(rows: MarketingPlanRow[]): MarketingPlanRow[] {
  return rows.filter((r) => !isPlanNumberDimensionLabel(r.label));
}

function isSeparatorRow(row: string[]): boolean {
  return row.every((c) => /^:?-+:?$/.test(c.trim()));
}

function parseTableCells(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((c) => normalizeMarketingPlanText(stripMdBold(c.trim())));
}

function extractPlanNameFromHeader(header: string): string {
  const cleaned = stripMdBold(header.trim());
  const m = cleaned.match(
    /^方案\s*[一二三四123ABC]\s*[·.、：:]\s*(.+?)(?:\s*[（(]推荐[)）])?\s*$/i,
  );
  if (m?.[1]) return m[1].trim().slice(0, 80);
  const stripped = cleaned
    .replace(/^方案\s*[一二三四123ABC]\s*[·.、：:]?\s*/i, "")
    .replace(/\s*[（(]推荐[)）]\s*$/, "")
    .trim();
  return (stripped || cleaned).slice(0, 80);
}

/** 将会话区任意维度标签映射到 Step3 沿用的四槽（最佳努力） */
export function mapDimensionLabel(
  label: string,
): "angle" | "painPoint" | "outcome" | "mood" | null {
  const t = stripMdBold(label);
  if (/核心逻辑|切入/.test(t)) return "angle";
  if (/爆点|立住|击中|痛点|用户痛/.test(t) && !/切入|核心逻辑/.test(t)) return "painPoint";
  if (/收获|结果|收益|诉求|表现|预期/.test(t)) return "outcome";
  if (/情绪|视觉|风格|调性|排布|投放|主图/.test(t)) return "mood";
  return null;
}

type PlanFields = Pick<MarketingPlan, "angle" | "painPoint" | "outcome" | "mood">;

function emptyPlanFields(): PlanFields {
  return { angle: "", painPoint: "", outcome: "", mood: "" };
}

export function syncLegacyFieldsFromRows(plan: MarketingPlan): MarketingPlan {
  const fields = emptyPlanFields();
  const rows = plan.rows?.length ? plan.rows : marketingPlanDisplayRows(plan);
  for (const row of rows) {
    const key = mapDimensionLabel(row.label);
    if (key && row.content.trim()) fields[key] = row.content.trim();
  }
  return {
    ...plan,
    angle: fields.angle || plan.angle,
    painPoint: fields.painPoint || plan.painPoint,
    outcome: fields.outcome || plan.outcome,
    mood: fields.mood || plan.mood,
    rows: filterPlanRows(rows),
  };
}

/** 中间区表格行：优先 rows，否则回落四槽；不含方案编号 */
export function marketingPlanDisplayRows(plan: MarketingPlan): MarketingPlanRow[] {
  if (plan.rows?.length) {
    return filterPlanRows(
      plan.rows.filter((r) => r.label.trim() || r.content.trim()),
    );
  }
  return MARKETING_PLAN_DIMENSIONS.map(({ key, label }) => ({
    label,
    content: String(plan[key] ?? "").trim(),
  })).filter((r) => r.content);
}

function buildPlanFromTable(
  headerLabel: string,
  bodyRows: string[][],
): MarketingPlan | null {
  const rows: MarketingPlanRow[] = [];
  const fields = emptyPlanFields();

  for (const row of bodyRows) {
    if (row.length < 2) continue;
    const label = String(row[0] ?? "").trim();
    const content = normalizeMarketingPlanText(String(row[1] ?? ""));
    if (!label && !content) continue;
    if (isPlanNumberDimensionLabel(label)) continue;
    rows.push({ label, content });
    const key = mapDimensionLabel(label);
    if (key && content) fields[key] = content;
  }

  if (rows.length === 0) return null;

  const no = planNoFromLabel(headerLabel, 0);
  const name = extractPlanNameFromHeader(headerLabel) || `方案 ${no || rows.length}`;
  return syncLegacyFieldsFromRows({
    no: no || 0,
    name,
    ...fields,
    rows,
  });
}

const PLAN_HEADER_RE =
  /^(?:#{1,4}\s+)?(?:\*\*)?(方案\s*[一二三四123ABC]\s*[·.、：:]\s*.+?)(?:\*\*)?(?:\s*[（(]推荐[)）])?\s*$/i;

/** Step2 会话区格式：每个方案独立「维度 | 内容」竖表 */
function parseVerticalMarketingPlans(text: string): ProductDesign["marketingPlans"] {
  const plans: ProductDesign["marketingPlans"] = [];
  const lines = text.split("\n");
  let pendingHeader: string | null = null;
  let tableBuffer: string[][] = [];

  function flushVerticalTable() {
    if (tableBuffer.length === 0) return;

    const dataRows = tableBuffer.filter((r) => !isSeparatorRow(r));
    if (dataRows.length === 0) {
      tableBuffer = [];
      return;
    }

    let planHeader = pendingHeader;
    let startIdx = 0;

    if (
      dataRows[0]?.length === 1 &&
      /方案\s*[一二三四123ABC]/i.test(dataRows[0][0] ?? "")
    ) {
      planHeader = planHeader ?? dataRows[0][0]!;
      startIdx = 1;
    }

    const headerRow = dataRows[startIdx];
    const isDimensionTable =
      headerRow?.some((c) => /维度/.test(c)) &&
      headerRow?.some((c) => /内容/.test(c));

    if (!isDimensionTable) {
      tableBuffer = [];
      return;
    }

    const headerLabel = planHeader ?? `方案 ${plans.length + 1}`;
    const built = buildPlanFromTable(headerLabel, dataRows.slice(startIdx + 1));
    if (built) {
      plans.push({ ...built, no: plans.length + 1 });
    }
    pendingHeader = null;
    tableBuffer = [];
  }

  for (const line of lines) {
    const t = line.trim();
    const headerMatch = t.match(PLAN_HEADER_RE);
    if (headerMatch) {
      flushVerticalTable();
      pendingHeader = stripMdBold(headerMatch[1]!);
      continue;
    }
    if (t.startsWith("|") && t.endsWith("|")) {
      tableBuffer.push(parseTableCells(t));
      continue;
    }
    flushVerticalTable();
  }
  flushVerticalTable();

  return normalizeMarketingPlansList(plans);
}

/** 会话区 Step2 总表：编号 | 方案名称 | 切入逻辑 | …（一行一套，列名原样保留） */
function parseSummaryHorizontalMarketingPlans(
  text: string,
): ProductDesign["marketingPlans"] {
  const tableRows: string[][] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("|") || !t.endsWith("|")) continue;
    const cells = parseTableCells(t);
    if (isSeparatorRow(cells)) continue;
    tableRows.push(cells);
  }

  const headerIdx = tableRows.findIndex(
    (r) =>
      r.some((c) => /方案名称/.test(c)) &&
      r.some((c) => /切入/.test(c)) &&
      !/^方案\s*[一二三四123ABC]/i.test(r[0] ?? ""),
  );
  if (headerIdx < 0) return [];

  const headers = tableRows[headerIdx]!;
  const nameCol = headers.findIndex((c) => /方案名称/.test(c));
  const noCol = headers.findIndex((c) =>
    /^编号$|^序号$|^方案编号$|^#$/i.test(c.trim()),
  );

  const dimensionCols = headers
    .map((label, i) => ({ i, label: label.trim() }))
    .filter(
      ({ i, label }) =>
        i !== nameCol &&
        i !== noCol &&
        label.length > 0 &&
        !isPlanNumberDimensionLabel(label),
    );

  if (dimensionCols.length === 0) return [];

  const plans: ProductDesign["marketingPlans"] = [];

  for (const row of tableRows.slice(headerIdx + 1)) {
    const nameRaw = normalizeMarketingPlanText(
      (nameCol >= 0 ? row[nameCol] : row[1])?.trim() ??
        row.find((c) => c.trim())?.trim() ??
        "",
    );
    if (!nameRaw || /^编号$|^方案名称$/i.test(nameRaw)) continue;

    const rows: MarketingPlanRow[] = dimensionCols
      .map(({ i, label }) => ({
        label,
        content: normalizeMarketingPlanText(String(row[i] ?? "")),
      }))
      .filter((r) => r.content);

    if (rows.length === 0) continue;

    const noFromCol =
      noCol >= 0 ? Number.parseInt(String(row[noCol] ?? "").trim(), 10) : NaN;
    const no = Number.isFinite(noFromCol) && noFromCol > 0
      ? noFromCol
      : plans.length + 1;

    plans.push(
      syncLegacyFieldsFromRows({
        no,
        name: nameRaw.slice(0, 80),
        angle: "",
        painPoint: "",
        outcome: "",
        mood: "",
        rows,
      }),
    );
  }

  return normalizeMarketingPlansList(plans);
}

function collectMarkdownTableRows(text: string): string[][] {
  const tableRows: string[][] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("|") || !t.endsWith("|")) continue;
    const cells = parseTableCells(t);
    if (isSeparatorRow(cells)) continue;
    tableRows.push(cells);
  }
  return tableRows;
}

function isPlanColumnHeader(cell: string): boolean {
  const t = cell.trim();
  return /方案\s*[ABCabc123一二三]|^方案\s*[123]$|^A$|^B$|^C$/i.test(t);
}

/** 误把「维度×方案」矩阵表按行解析成方案（中间区出现「切入角度/情绪基调」三卡片） */
export function marketingPlansLookLikeMisParsedMatrix(
  plans: ProductDesign["marketingPlans"],
): boolean {
  if (plans.length < 2) return false;
  let dimLike = 0;
  for (const p of plans) {
    const n = p.name.trim();
    if (
      /^(切入|角度|情绪|基调|视觉|风格|痛点|收获|逻辑|维度|主视觉)/.test(n) &&
      !/方案|焦虑|场景|性价比|型$/.test(n)
    ) {
      dimLike += 1;
    }
  }
  return dimLike >= 2;
}

function looksLikeMatrixMarketingTable(tableRows: string[][]): boolean {
  const headerIdx = tableRows.findIndex((r) => {
    const first = (r[0] ?? "").trim();
    if (!/维度|对比|项目/.test(first)) return false;
    return r.slice(1).filter((c) => isPlanColumnHeader(c) || /方案/.test(c)).length >= 2;
  });
  return headerIdx >= 0;
}

/** Step2 矩阵表：| 维度 | 方案A | 方案B | 方案C |（列为方案、行为维度） */
function parseMatrixMarketingPlans(text: string): ProductDesign["marketingPlans"] {
  const tableRows = collectMarkdownTableRows(text);
  const headerIdx = tableRows.findIndex((r) => {
    const first = (r[0] ?? "").trim();
    if (!/维度|对比|项目/.test(first)) return false;
    return r.slice(1).filter((c) => isPlanColumnHeader(c) || /方案/.test(c)).length >= 2;
  });
  if (headerIdx < 0) return [];

  const header = tableRows[headerIdx]!;
  const planCols = header
    .slice(1)
    .map((label, i) => ({ colIndex: i + 1, label: label.trim() }))
    .filter(({ label }) => label.length > 0);

  if (planCols.length < 2) return [];

  const plans: ProductDesign["marketingPlans"] = planCols.map((col, idx) => {
    const name =
      extractPlanNameFromHeader(col.label) ||
      col.label.replace(/^方案\s*[ABCabc]/i, "").trim() ||
      col.label ||
      `方案 ${idx + 1}`;
    return syncLegacyFieldsFromRows({
      no: idx + 1,
      name: name.slice(0, 80),
      angle: "",
      painPoint: "",
      outcome: "",
      mood: "",
      rows: [] as MarketingPlanRow[],
    });
  });

  for (const row of tableRows.slice(headerIdx + 1)) {
    const dimLabel = (row[0] ?? "").trim();
    if (!dimLabel || /^维度|对比|项目$/i.test(dimLabel)) continue;
    for (let pi = 0; pi < planCols.length; pi++) {
      const col = planCols[pi]!;
      const content = normalizeMarketingPlanText(String(row[col.colIndex] ?? ""));
      if (!content) continue;
      const plan = plans[pi];
      if (plan) {
        if (!plan.rows) plan.rows = [];
        plan.rows.push({ label: dimLabel, content });
      }
    }
  }

  return normalizeMarketingPlansList(
    plans.filter((p) => (p.rows?.length ?? 0) > 0 || p.name.trim()),
  );
}

/** 横向表格：一行一套（无「方案名称」列时的旧格式兜底） */
function parseLegacyHorizontalMarketingPlans(text: string): ProductDesign["marketingPlans"] {
  const tableRows = collectMarkdownTableRows(text);
  if (looksLikeMatrixMarketingTable(tableRows)) return [];

  const headerIdx = tableRows.findIndex(
    (r) =>
      r.some((c) => /方案|切入|痛点|收获|情绪|核心|维度/.test(c)) &&
      !r.some((c) => /方案名称/.test(c)) &&
      !/^方案\s*[ABC123一二三四]/i.test(r[0] ?? ""),
  );
  const start = headerIdx >= 0 ? headerIdx + 1 : 0;
  const headerRow = headerIdx >= 0 ? tableRows[headerIdx]! : null;
  const plans: ProductDesign["marketingPlans"] = [];

  for (let i = 0; i < tableRows.slice(start).length; i++) {
    const row = tableRows[start + i]!;
    if (row.length < 4) continue;
    const label = row[0] ?? "";
    if (
      headerIdx < 0 &&
      i === 0 &&
      !/方案\s*[ABCabc123一二三四]|痛点|场景|品质/i.test(label)
    ) {
      continue;
    }
    const name =
      extractPlanNameFromHeader(label) ||
      label.replace(/^方案\s*[ABC123]\s*[·.]?\s*/i, "").trim() ||
      label;
    const dimLabels =
      headerRow && headerRow.length >= row.length
        ? headerRow.slice(1).map((h) => h.trim() || "内容")
        : ["切入逻辑", "击中痛点", "用户收获", "情绪风格"];
    const rows: MarketingPlanRow[] = row
      .slice(1)
      .map((content, ci) => ({
        label: dimLabels[ci] ?? `维度 ${ci + 1}`,
        content: content ?? "",
      }))
      .filter((r) => r.content.trim());
    plans.push(
      syncLegacyFieldsFromRows({
        no: plans.length + 1,
        name: name.slice(0, 80) || `方案${plans.length + 1}`,
        angle: "",
        painPoint: "",
        outcome: "",
        mood: "",
        rows,
      }),
    );
  }

  return normalizeMarketingPlansList(plans);
}

/** 从助手 Markdown 解析 Step2（与会话区 strip 后同源；总表优先于竖表） */
export function parseMarketingPlansFromMarkdown(
  text: string,
): ProductDesign["marketingPlans"] {
  const stripped = stripProductDesignFence(text);

  const matrix = parseMatrixMarketingPlans(stripped);
  if (matrix.length >= 2 && !marketingPlansLookLikeMisParsedMatrix(matrix)) {
    return matrix;
  }

  const summary = parseSummaryHorizontalMarketingPlans(stripped);
  if (summary.length >= 2) return summary;

  const vertical = parseVerticalMarketingPlans(stripped);
  const legacy = parseLegacyHorizontalMarketingPlans(stripped);

  const candidates = [matrix, summary, vertical, legacy].filter(
    (p) => p.length >= 2 && !marketingPlansLookLikeMisParsedMatrix(p),
  );
  if (candidates.length === 0) {
    return legacy.length > 0 ? legacy : vertical.length > 0 ? vertical : matrix;
  }
  return candidates.sort(
    (a, b) => marketingPlansQualityScore(b) - marketingPlansQualityScore(a),
  )[0]!;
}

/** 按数组顺序重编号为 1…N，补全空 name，最多 3 套 */
export function normalizeMarketingPlansList(
  plans: ProductDesign["marketingPlans"],
): ProductDesign["marketingPlans"] {
  const out: ProductDesign["marketingPlans"] = [];
  for (const p of plans) {
    if (out.length >= 3) break;
    if (!p) continue;
    const idx = out.length + 1;
    const synced = syncLegacyFieldsFromRows(p);
    const rawName = normalizeMarketingPlanText(String(synced.name ?? "").trim());
    out.push({
      no: idx,
      name: rawName.slice(0, 80) || `方案 ${idx}`,
      angle: String(synced.angle ?? "").trim(),
      painPoint: String(synced.painPoint ?? "").trim(),
      outcome: String(synced.outcome ?? "").trim(),
      mood: String(synced.mood ?? "").trim(),
      rows: filterPlanRows(synced.rows ?? []),
    });
  }
  return out;
}

function isTemplatePlaceholderPlan(p: MarketingPlan): boolean {
  return (
    p.angle === "切入逻辑" ||
    p.painPoint === "击中痛点" ||
    p.outcome === "用户收获" ||
    p.mood === "主图情绪风格"
  );
}

function isGenericPlanName(name: string, no: number): boolean {
  const n = name.trim();
  return n === `方案 ${no}` || n === `方案${no}` || /^方案\s*\d+$/i.test(n);
}

/** JSON 误写主图职责时（如「第 1 张」「首图 · 核心卖点」） */
export function marketingPlansLookLikeMainImages(
  plans: ProductDesign["marketingPlans"],
): boolean {
  if (plans.length === 0) return false;
  return plans.some(
    (p) =>
      /第\s*\d+\s*张/.test(p.name) ||
      /首图|卖点分解|使用场景|细节质感|规格|参数/.test(p.angle) ||
      /首图|卖点分解|使用场景/.test(p.name),
  );
}

function marketingPlansQualityScore(plans: ProductDesign["marketingPlans"]): number {
  if (plans.length === 0) return 0;
  if (marketingPlansLookLikeMainImages(plans)) return -10;
  if (marketingPlansLookLikeMisParsedMatrix(plans)) return -20;
  let score = plans.length * 2;
  for (const p of plans) {
    if (isTemplatePlaceholderPlan(p)) score -= 4;
    if (/第\s*\d+\s*张/.test(p.name)) score -= 6;
    if (isGenericPlanName(p.name, p.no)) score -= 4;
    if (/痛点|场景|细节|焦虑|种草|质感|收益|高效|职场|定位|流量|气质/.test(p.name)) {
      score += 3;
    }
    if ((p.rows?.length ?? 0) >= 4) score += 4;
    if (p.rows?.some((r) => /预期收获|主图情绪|击中用户/.test(r.label))) score += 5;
    if (p.angle.length > 20 && !/首图|卖点分解/.test(p.angle)) score += 1;
  }
  return score;
}

/** JSON 与 Markdown 取更可信、套数更多的一侧 */
export function coalesceMarketingPlansFromText(
  fromJson: ProductDesign["marketingPlans"] | undefined,
  markdownText: string,
): ProductDesign["marketingPlans"] {
  const jsonPlans = normalizeMarketingPlansList(fromJson ?? []);
  const mdPlans = parseMarketingPlansFromMarkdown(markdownText);

  if (mdPlans.length === 0) return jsonPlans;
  if (jsonPlans.length === 0) return mdPlans;
  if (marketingPlansLookLikeMainImages(jsonPlans)) return mdPlans;
  if (jsonPlans.some(isTemplatePlaceholderPlan) && mdPlans.length > 0) return mdPlans;
  if (mdPlans.length > jsonPlans.length) return mdPlans;
  if (mdPlans.length >= 3 && jsonPlans.length < 3) return mdPlans;
  if (marketingPlansQualityScore(mdPlans) >= marketingPlansQualityScore(jsonPlans)) {
    return mdPlans;
  }
  return jsonPlans;
}

/** 从聊天记录中找 Step2 营销方案最完整的助手原文 */
export function findStep2AssistantText(
  chatHistory: Array<{ role: string; content: string }>,
  fallbackRaw = "",
): string {
  let best = "";
  let bestScore = 0;
  for (let i = 0; i < chatHistory.length; i++) {
    const m = chatHistory[i]!;
    if (m.role !== "assistant") continue;
    const plans = parseMarketingPlansFromMarkdown(m.content);
    if (plans.length === 0) continue;
    if (marketingPlansLookLikeMainImages(plans)) continue;
    if (marketingPlansLookLikeMisParsedMatrix(plans)) continue;
    const score = marketingPlansQualityScore(plans) + i * 0.01;
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

/** 展示用：与会话区同源（strip 后同一解析器） */
export function resolveMarketingPlansForDisplay(project: {
  design: ProductDesign | null;
  chatHistory: Array<{ role: string; content: string }>;
}): ProductDesign["marketingPlans"] {
  // stored 优先：`design` 是权威源，用户在中间区的编辑不得被聊天重解析覆盖
  const stored = project.design?.marketingPlans ?? [];
  if (stored.length > 0 && !marketingPlansLookLikeMisParsedMatrix(stored)) return stored;

  const fromChat = parseMarketingPlansFromMarkdown(findStep2AssistantText(project.chatHistory));
  if (fromChat.length === 0) return stored;
  if (stored.length === 0) return fromChat;
  // stored 是误解析的购买理由矩阵，用聊天记录兜底
  return marketingPlansLookLikeMisParsedMatrix(fromChat) ? stored : fromChat;
}

/** 与会话区 Step2 展示文本完全一致（去 JSON 围栏） */
export function step2MarkdownForDisplay(text: string): string {
  return stripProductDesignFence(text);
}

/** 落库前：合并 Markdown 方案 + 未选方案时剔除超前步骤字段 */
export function prepareProductDesignPatch(
  prev: ProductDesign | null,
  patch: Partial<ProductDesign>,
  opts?: { markdownText?: string },
): Partial<ProductDesign> {
  const out: Partial<ProductDesign> = { ...patch };
  const selected = out.selectedPlanNo ?? prev?.selectedPlanNo ?? null;

  if (opts?.markdownText?.trim()) {
    const coalescedAnalysis = coalesceAnalysisFromText(
      out.analysis ?? prev?.analysis,
      opts.markdownText,
    );
    if (coalescedAnalysis) out.analysis = coalescedAnalysis;

    const coalesced = coalesceMarketingPlansFromText(
      out.marketingPlans ?? prev?.marketingPlans,
      opts.markdownText,
    );
    if (coalesced.length > 0) out.marketingPlans = coalesced;
  } else if (out.marketingPlans?.length) {
    const normalized = normalizeMarketingPlansList(out.marketingPlans);
    if (marketingPlansLookLikeMainImages(normalized)) {
      delete out.marketingPlans;
    } else {
      out.marketingPlans = normalized;
    }
  }

  if (opts?.markdownText?.trim() && selected != null) {
    const coalescedReasons = coalesceBuyingReasonFromText(
      out.buyingReasonBrief ?? prev?.buyingReasonBrief,
      out.buyingReasons ?? prev?.buyingReasons,
      opts.markdownText,
    );
    if (coalescedReasons.brief) {
      out.buyingReasonBrief = coalescedReasons.brief;
      const derived = deriveBuyingReasonsFromBrief(coalescedReasons.brief);
      if (derived.length > 0) {
        out.buyingReasons = derived;
      } else if (coalescedReasons.reasons.length > 0) {
        out.buyingReasons = coalescedReasons.reasons;
      }
    } else if (coalescedReasons.reasons.length > 0) {
      out.buyingReasons = coalescedReasons.reasons;
    }
  }

  const hasReasonsForStep4 =
    (out.buyingReasons?.length ?? 0) > 0 ||
    (prev?.buyingReasons.length ?? 0) > 0 ||
    hasBuyingReasonBriefContent(out.buyingReasonBrief ?? prev?.buyingReasonBrief);

  if (opts?.markdownText?.trim() && selected != null && hasReasonsForStep4) {
    const coalescedMain = coalesceMainImagesFromText(
      out.mainImages ?? prev?.mainImages,
      opts.markdownText,
    );
    if (coalescedMain.length > 0) out.mainImages = coalescedMain;
  }

  const hasMainCopyForStep7 =
    (out.mainImages?.length ?? 0) > 0 || (prev?.mainImages.length ?? 0) > 0;

  if (opts?.markdownText?.trim() && selected != null && hasMainCopyForStep7) {
    const coalescedOutline = coalesceDetailOutlineFromText(
      out.detailOutline ?? prev?.detailOutline,
      opts.markdownText,
    );
    if (coalescedOutline.length > 0) out.detailOutline = coalescedOutline;
  }

  if (selected == null) {
    out.buyingReasons = [];
    out.buyingReasonBrief = undefined;
    out.mainImages = [];
    out.detailOutline = [];
    out.detailPages = [];
  } else {
    const hasReasons =
      (out.buyingReasons?.length ?? 0) > 0 ||
      (prev?.buyingReasons.length ?? 0) > 0 ||
      hasBuyingReasonBriefContent(out.buyingReasonBrief ?? prev?.buyingReasonBrief);
    if (!hasReasons) {
      if (patch.mainImages === undefined) delete out.mainImages;
      if (patch.detailOutline === undefined) delete out.detailOutline;
      if (patch.detailPages === undefined) delete out.detailPages;
    } else {
      const hasMainCopy =
        (out.mainImages?.length ?? 0) > 0 ||
        (prev?.mainImages.length ?? 0) > 0;
      if (!hasMainCopy) {
        if (patch.detailOutline === undefined) delete out.detailOutline;
        if (patch.detailPages === undefined) delete out.detailPages;
      }
    }
  }

  return out;
}
