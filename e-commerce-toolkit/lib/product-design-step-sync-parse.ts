import type { ProductDesign, ProductDesignMainImage } from "@/lib/product-design-types";
import { stripProductDesignFence } from "@/lib/product-design-assistant-display";
import { isStep3ReadyForDownstream } from "@/lib/product-design-buying-reason-parse";
import { sanitizeMiddlePanelMarkdown } from "@/lib/product-design-middle-sanitize";

type DetailOutlineRow = ProductDesign["detailOutline"][number];

function normalizeCell(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\*\*/g, "")
    .trim();
}

function isSeparatorRow(row: string[]): boolean {
  return row.every((c) => /^:?-+:?$/.test(c.trim()));
}

function parseTableCells(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((c) => normalizeCell(c.trim()));
}

function findColumnIndex(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    if (patterns.some((p) => p.test(headers[i] ?? ""))) return i;
  }
  return -1;
}

function mapOutlineTag(raw: string): DetailOutlineRow["tag"] {
  const t = raw.trim();
  if (/情绪|种草/.test(t)) return "emotion";
  if (/证明|背书|实力|价值证明/.test(t)) return "proof";
  if (/风控|顾虑|异议|打消/.test(t)) return "risk";
  if (/^emotion$/i.test(t)) return "emotion";
  if (/^proof$/i.test(t)) return "proof";
  if (/^risk$/i.test(t)) return "risk";
  return "other";
}

function emptyMainImage(index: number): ProductDesignMainImage {
  return {
    index,
    purpose: "",
    layers: {
      title: "",
      bullets: [],
    },
    emphasis: { bold: [], color: [] },
  };
}

function parseLabelValue(line: string): { label: string; value: string } | null {
  const t = line.trim().replace(/^[-*]\s+/, "");
  const m = t.match(/^(?:\*\*)?(.+?)(?:\*\*)?[：:]\s*(.+)$/);
  if (!m?.[1] || !m[2]) return null;
  return { label: normalizeCell(m[1]), value: normalizeCell(m[2]) };
}

function applyLayerField(
  layers: ProductDesignMainImage["layers"],
  label: string,
  value: string,
): boolean {
  if (/顶部|引导小字/.test(label)) {
    layers.topHint = value;
    return true;
  }
  if (/核心主标题|^主标题$/.test(label)) {
    layers.title = value;
    return true;
  }
  if (/副标题/.test(label)) {
    layers.subtitle = value;
    return true;
  }
  if (/交付|服务说明/.test(label)) {
    layers.delivery = value;
    return true;
  }
  if (/底部|信任收口/.test(label)) {
    layers.footer = value;
    return true;
  }
  return false;
}

function parseEmphasisBlock(text: string): ProductDesignMainImage["emphasis"] {
  const bold: string[] = [];
  const color: string[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    const boldM = t.match(/(?:【)?(?:需要)?放大加粗[^】：:]*[】]?[：:]\s*(.+)$/i);
    if (boldM?.[1]) {
      bold.push(
        ...boldM[1]
          .split(/[,，、|]/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
    const colorM = t.match(/(?:【)?(?:需要)?彩色[^】：:]*[】]?[：:]\s*(.+)$/i);
    if (colorM?.[1]) {
      color.push(
        ...colorM[1]
          .split(/[,，、|]/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
  }
  return { bold, color };
}

/** 提取 Step4 片段 */
export function extractStep4DisplayMarkdown(text: string): string {
  const stripped = stripProductDesignFence(text);
  if (!stripped.trim()) return "";

  const endPattern = /\n#{1,3}\s*Step\s*(?:5|6|7)|\n```\s*product-design/i;
  const match = stripped.match(
    /(?:^|\n)(#{1,3}\s*Step\s*4[^\n]*[\s\S]*?)(?=\n#{1,3}\s*Step\s*(?:5|6|7)|\n```\s*product-design|$)/i,
  );
  if (match?.[1]?.trim()) return match[1].trim();

  const idx = stripped.search(/Step\s*4|主图分层定稿|主图分层文案/i);
  if (idx >= 0) {
    const slice = stripped.slice(idx);
    const end = slice.search(endPattern);
    const section = (end >= 0 ? slice.slice(0, end) : slice).trim();
    if (/主图\s*\d|核心主标题|主标题/.test(section)) return section;
  }
  return "";
}

/** 提取 Step7 片段 */
export function extractStep7DisplayMarkdown(text: string): string {
  const stripped = stripProductDesignFence(text);
  if (!stripped.trim()) return "";

  const endPattern = /\n#{1,3}\s*Step\s*8|\n```\s*product-design/i;
  const match = stripped.match(
    /(?:^|\n)(#{1,3}\s*Step\s*7[^\n]*[\s\S]*?)(?=\n#{1,3}\s*Step\s*8|\n```\s*product-design|$)/i,
  );
  if (match?.[1]?.trim()) return match[1].trim();

  const idx = stripped.search(/Step\s*7|详情页.*架构|销售逻辑框架/i);
  if (idx >= 0) {
    const slice = stripped.slice(idx);
    const end = slice.search(endPattern);
    const section = (end >= 0 ? slice.slice(0, end) : slice).trim();
    if (/第\s*\d+\s*屏|营销任务|detailOutline/i.test(section)) return section;
  }
  return "";
}

export function parseMainImagesFromMarkdown(text: string): ProductDesignMainImage[] {
  const section = extractStep4DisplayMarkdown(text) || stripProductDesignFence(text);
  const chunks = section.split(/(?=^#{2,4}\s*主图\s*\d+)/im);
  const images: ProductDesignMainImage[] = [];

  for (const chunk of chunks) {
    const header = chunk.match(/^#{2,4}\s*主图\s*(\d+)\s*(?:[·.|：:\-—]\s*(.+))?/im);
    if (!header?.[1]) continue;

    const index = Number.parseInt(header[1], 10);
    if (!Number.isFinite(index) || index <= 0) continue;

    const item = emptyMainImage(index);
    item.purpose = normalizeCell(header[2] ?? "");
    const bullets: string[] = [];
    let collectingBullets = false;

    for (const rawLine of chunk.split("\n")) {
      const line = rawLine.trim();
      if (!line || /^#{2,4}\s*主图\s*\d+/i.test(line)) continue;

      if (/^[-*]\s+/.test(line) && collectingBullets) {
        bullets.push(normalizeCell(line.replace(/^[-*]\s+/, "")));
        continue;
      }

      const field = parseLabelValue(line);
      if (!field) continue;

      collectingBullets = /卖点|核心卖点/.test(field.label);
      if (collectingBullets) {
        if (field.value) bullets.push(field.value);
        continue;
      }

      applyLayerField(item.layers, field.label, field.value);
    }

    if (bullets.length > 0) item.layers.bullets = bullets.slice(0, 5);
    if (!item.layers.title.trim()) {
      const titleFromPurpose = item.purpose.match(/^首图|^场景|^细节/) ? item.purpose : "";
      if (titleFromPurpose) item.layers.title = titleFromPurpose;
      else continue;
    }
    item.emphasis = parseEmphasisBlock(chunk);
    images.push(item);
  }

  return images.sort((a, b) => a.index - b.index);
}

export function parseDetailOutlineFromMarkdown(text: string): DetailOutlineRow[] {
  const section = extractStep7DisplayMarkdown(text) || stripProductDesignFence(text);
  const lines = section.split("\n");
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

  let best: DetailOutlineRow[] = [];

  for (const table of tableBlocks) {
    const dataRows = table.filter((r) => !isSeparatorRow(r));
    if (dataRows.length < 2) continue;

    const head = dataRows[0]!;
    const body = dataRows.slice(1);
    const indexIdx = findColumnIndex(head, [/屏号|第.*屏|序号|^#$/]);
    const missionIdx = findColumnIndex(head, [/营销任务|核心任务|本屏任务|mission/i]);
    const doubtIdx = findColumnIndex(head, [/疑虑|下单|doubt/i]);
    const titleIdx = findColumnIndex(head, [/标题方向|主题|title/i]);
    const tagIdx = findColumnIndex(head, [/页面类型|类型|tag|职责/i]);

    if (missionIdx < 0 && doubtIdx < 0 && titleIdx < 0) continue;

    const rows: DetailOutlineRow[] = [];
    for (const row of body) {
      const pick = (idx: number) => (idx >= 0 ? normalizeCell(row[idx] ?? "") : "");
      let index = indexIdx >= 0 ? Number.parseInt(pick(indexIdx).replace(/\D/g, ""), 10) : rows.length + 1;
      if (!Number.isFinite(index) || index <= 0) index = rows.length + 1;

      const mission = pick(missionIdx) || pick(0);
      const doubtResolved = pick(doubtIdx);
      const titleDirection = pick(titleIdx);
      const tag = mapOutlineTag(pick(tagIdx));

      if (!mission && !doubtResolved && !titleDirection) continue;
      rows.push({ index, mission, doubtResolved, titleDirection, tag });
    }

    if (rows.length > best.length) best = rows;
  }

  if (best.length > 0) return best;

  const listRows: DetailOutlineRow[] = [];
  for (const line of lines) {
    const m = line.trim().match(/^#{0,4}\s*第?\s*(\d+)\s*屏[：:]\s*(.+)$/);
    if (!m?.[1] || !m[2]) continue;
    const index = Number.parseInt(m[1], 10);
    const body = normalizeCell(m[2]);
    const parts = body.split(/[·|｜|]/).map((s) => s.trim()).filter(Boolean);
    listRows.push({
      index,
      mission: parts[0] ?? body,
      doubtResolved: parts[1] ?? "",
      titleDirection: parts[2] ?? "",
      tag: mapOutlineTag(parts[3] ?? ""),
    });
  }

  return listRows.sort((a, b) => a.index - b.index);
}

function mainImageQualityScore(items: ProductDesignMainImage[]): number {
  let score = 0;
  score += items.length * 4;
  for (const item of items) {
    if (item.layers.title.trim().length > 4) score += 2;
    if (item.layers.subtitle?.trim()) score += 1;
    if (item.layers.bullets.length > 0) score += 1;
    if (item.purpose.trim()) score += 1;
  }
  return score;
}

function extractMainImagesFromProductDesignFence(text: string): ProductDesignMainImage[] {
  const fenced = Array.from(text.matchAll(/```product-design\s*([\s\S]*?)```/gi)).map((m) =>
    m[1]?.trim(),
  );
  const unclosed = text.match(/```product-design\s*([\s\S]*)$/i)?.[1]?.trim();
  const candidates = [...fenced, unclosed].filter(Boolean) as string[];
  for (const raw of candidates.reverse()) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as {
        mainImages?: ProductDesignMainImage[];
      };
      if (Array.isArray(parsed.mainImages) && parsed.mainImages.length > 0) {
        return parsed.mainImages;
      }
    } catch {
      /* try next candidate */
    }
  }
  return [];
}

function extractDetailOutlineFromProductDesignFence(text: string): DetailOutlineRow[] {
  const fenced = Array.from(text.matchAll(/```product-design\s*([\s\S]*?)```/gi)).map((m) =>
    m[1]?.trim(),
  );
  const unclosed = text.match(/```product-design\s*([\s\S]*)$/i)?.[1]?.trim();
  const candidates = [...fenced, unclosed].filter(Boolean) as string[];
  for (const raw of candidates.reverse()) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as {
        detailOutline?: DetailOutlineRow[];
      };
      if (Array.isArray(parsed.detailOutline) && parsed.detailOutline.length > 0) {
        return parsed.detailOutline;
      }
    } catch {
      /* try next candidate */
    }
  }
  return [];
}

function scoreStep4AssistantMessage(content: string): number {
  const mdItems = parseMainImagesFromMarkdown(content);
  const jsonItems = extractMainImagesFromProductDesignFence(content);
  return Math.max(mainImageQualityScore(mdItems), mainImageQualityScore(jsonItems));
}

function scoreStep7AssistantMessage(content: string): number {
  const mdItems = parseDetailOutlineFromMarkdown(content);
  const jsonItems = extractDetailOutlineFromProductDesignFence(content);
  return Math.max(detailOutlineQualityScore(mdItems), detailOutlineQualityScore(jsonItems));
}

function detailOutlineQualityScore(items: DetailOutlineRow[]): number {
  let score = 0;
  score += items.length * 3;
  for (const row of items) {
    if (row.mission.trim().length > 6) score += 1;
    if (row.doubtResolved.trim()) score += 1;
    if (row.titleDirection.trim()) score += 1;
  }
  return score;
}

function mergeMainImage(
  prev: ProductDesignMainImage | undefined,
  next: ProductDesignMainImage,
): ProductDesignMainImage {
  if (!prev) return next;
  return {
    ...prev,
    ...next,
    purpose: next.purpose || prev.purpose,
    layers: {
      ...prev.layers,
      ...next.layers,
      title: next.layers.title || prev.layers.title,
      bullets: next.layers.bullets.length >= prev.layers.bullets.length ? next.layers.bullets : prev.layers.bullets,
    },
    emphasis: {
      bold: next.emphasis.bold.length >= prev.emphasis.bold.length ? next.emphasis.bold : prev.emphasis.bold,
      color: next.emphasis.color.length >= prev.emphasis.color.length ? next.emphasis.color : prev.emphasis.color,
    },
    imageUrl: prev.imageUrl,
    assetId: prev.assetId,
    genPrompt: prev.genPrompt ?? next.genPrompt,
  };
}

function mergeMainImagesList(
  base: ProductDesignMainImage[],
  incoming: ProductDesignMainImage[],
): ProductDesignMainImage[] {
  if (incoming.length === 0) return base;
  const byIndex = new Map(base.map((m) => [m.index, m]));
  for (const item of incoming) {
    byIndex.set(item.index, mergeMainImage(byIndex.get(item.index), item));
  }
  return Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
}

export function coalesceMainImagesFromText(
  stored: ProductDesignMainImage[] | undefined,
  markdownText: string,
): ProductDesignMainImage[] {
  const jsonItems = extractMainImagesFromProductDesignFence(markdownText);
  const mdItems = parseMainImagesFromMarkdown(markdownText);
  const base = stored ?? [];

  const candidates = [
    { items: mdItems, score: mainImageQualityScore(mdItems) },
    { items: jsonItems, score: mainImageQualityScore(jsonItems) },
    { items: base, score: mainImageQualityScore(base) },
  ].sort((a, b) => b.score - a.score);

  const best = candidates[0]?.items ?? [];
  if (best.length === 0) return base;
  return mergeMainImagesList(base, best);
}

export function coalesceDetailOutlineFromText(
  stored: DetailOutlineRow[] | undefined,
  markdownText: string,
): DetailOutlineRow[] {
  const jsonItems = extractDetailOutlineFromProductDesignFence(markdownText);
  const mdItems = parseDetailOutlineFromMarkdown(markdownText);
  const base = stored ?? [];

  const candidates = [
    { items: mdItems, score: detailOutlineQualityScore(mdItems) },
    { items: jsonItems, score: detailOutlineQualityScore(jsonItems) },
    { items: base, score: detailOutlineQualityScore(base) },
  ].sort((a, b) => b.score - a.score);

  const best = candidates[0]?.items ?? [];
  if (best.length === 0) return base;
  if (best.length >= base.length || detailOutlineQualityScore(best) >= detailOutlineQualityScore(base)) {
    const byIndex = new Map(base.map((r) => [r.index, r]));
    for (const row of best) {
      const prev = byIndex.get(row.index);
      byIndex.set(row.index, prev ? { ...prev, ...row, mission: row.mission || prev.mission } : row);
    }
    return Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
  }
  return base;
}

export function findStep4AssistantText(
  chatHistory: Array<{ role: string; content: string }>,
  fallbackRaw = "",
): string {
  let best = "";
  let bestScore = 0;
  for (const m of chatHistory) {
    if (m.role !== "assistant") continue;
    const score = scoreStep4AssistantMessage(m.content);
    if (score > bestScore) {
      bestScore = score;
      best = m.content;
    }
  }
  if (best) return best;
  return fallbackRaw.trim() || chatHistory.filter((m) => m.role === "assistant").at(-1)?.content || "";
}

export function findStep7AssistantText(
  chatHistory: Array<{ role: string; content: string }>,
  fallbackRaw = "",
): string {
  let best = "";
  let bestScore = 0;
  for (const m of chatHistory) {
    if (m.role !== "assistant") continue;
    const score = scoreStep7AssistantMessage(m.content);
    if (score > bestScore) {
      bestScore = score;
      best = m.content;
    }
  }
  if (best) return best;
  return fallbackRaw.trim() || chatHistory.filter((m) => m.role === "assistant").at(-1)?.content || "";
}

type ProductAnalysis = NonNullable<ProductDesign["analysis"]>;

function normalizeAnalysis(raw: Partial<ProductAnalysis>): ProductAnalysis {
  return {
    platformNotes: String(raw.platformNotes ?? "").trim(),
    surfacePainPoints: (raw.surfacePainPoints ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean),
    deepNeeds: (raw.deepNeeds ?? []).map((s) => String(s).trim()).filter(Boolean),
    differentiators: (raw.differentiators ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean),
    visualTone: String(raw.visualTone ?? "").trim(),
    forbiddenWords: (raw.forbiddenWords ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean),
  };
}

export function hasValidAnalysis(
  analysis: ProductDesign["analysis"] | null | undefined,
): boolean {
  if (!analysis) return false;
  return (
    analysis.platformNotes.trim().length > 0 ||
    analysis.surfacePainPoints.length > 0 ||
    analysis.deepNeeds.length > 0 ||
    analysis.differentiators.length > 0 ||
    analysis.visualTone.trim().length > 0
  );
}

function analysisRichness(analysis: ProductAnalysis): number {
  return (
    (analysis.platformNotes.trim() ? 4 : 0) +
    analysis.surfacePainPoints.length * 2 +
    analysis.deepNeeds.length * 2 +
    analysis.differentiators.length * 2 +
    (analysis.visualTone.trim() ? 2 : 0) +
    analysis.forbiddenWords.length
  );
}

function parseListLines(block: string): string[] {
  const items: string[] = [];
  for (const line of block.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const numbered = t.match(/^\d+[.)]\s+(.+)$/);
    if (numbered?.[1]) {
      items.push(normalizeCell(numbered[1]));
      continue;
    }
    const bullet = t.match(/^[-*]\s+(.+)$/);
    if (bullet?.[1]) {
      items.push(normalizeCell(bullet[1]));
    }
  }
  return items.filter(Boolean);
}

function extractSectionBody(text: string, headingPattern: RegExp): string {
  const lines = text.split("\n");
  let capturing = false;
  let headerLevel = 3;
  const body: string[] = [];
  for (const line of lines) {
    if (headingPattern.test(line)) {
      capturing = true;
      const hm = line.match(/^(#+)\s/);
      headerLevel = hm ? hm[1]!.length : 3;
      continue;
    }
    if (!capturing) continue;
    const hm = line.match(/^(#+)\s+\S/);
    if (hm && hm[1]!.length <= headerLevel) break;
    body.push(line);
  }
  return body.join("\n").trim();
}

function tryParseAnalysisJson(text: string): ProductAnalysis | null {
  const fenced = Array.from(
    text.matchAll(/```(?:product-design|json)\s*([\s\S]*?)```/gi),
  ).map((m) => m[1]?.trim());
  const unclosed = text.match(/```(?:product-design|json)\s*([\s\S]*)$/i)?.[1]?.trim();
  const candidates = [...fenced, unclosed, text].filter(Boolean) as string[];
  for (const candidate of candidates.reverse()) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as {
        analysis?: Partial<ProductAnalysis>;
      };
      if (parsed.analysis) {
        const normalized = normalizeAnalysis(parsed.analysis);
        if (hasValidAnalysis(normalized)) return normalized;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/** 从 Step1 助手 Markdown / JSON 围栏解析平台拆解 */
export function parseAnalysisFromMarkdown(text: string): ProductAnalysis | null {
  const fromJson = tryParseAnalysisJson(text);
  if (fromJson) return fromJson;

  const stripped = stripProductDesignFence(text);
  if (
    !/Step1|平台合规|平台拆解|表层痛点|深层隐性|差异化竞争|视觉调性|用户痛点与机会/.test(
      stripped,
    )
  ) {
    return null;
  }

  const platformNotes = extractSectionBody(
    stripped,
    /^#{2,3}\s*(?:平台浏览习惯|平台规则|平台策略|文案红线|平台合规)/,
  )
    .split("\n")
    .filter((l) => l.trim() && !/^[-*]\s/.test(l.trim()) && !/^\d+[.)]/.test(l.trim()))
    .join("\n")
    .trim();

  const analysis = normalizeAnalysis({
    platformNotes,
    surfacePainPoints: parseListLines(
      extractSectionBody(stripped, /^#{2,3}\s*表层痛点/),
    ),
    deepNeeds: parseListLines(extractSectionBody(stripped, /^#{2,3}\s*深层/)),
    differentiators: parseListLines(
      extractSectionBody(stripped, /^#{2,3}\s*差异化/),
    ),
    visualTone: extractSectionBody(stripped, /^#{2,3}\s*视觉调性/)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join(" "),
    forbiddenWords: parseListLines(
      extractSectionBody(stripped, /^#{2,3}\s*(?:需规避|规避表述|文案红线词)/),
    ),
  });

  return hasValidAnalysis(analysis) ? analysis : null;
}

function scoreStep1AssistantMessage(text: string): number {
  const parsed = parseAnalysisFromMarkdown(text);
  if (!parsed) return 0;
  return analysisRichness(parsed) + (text.includes("Step1") ? 3 : 0);
}

export function findStep1AssistantText(
  chatHistory: Array<{ role: string; content: string }>,
  fallbackRaw = "",
): string {
  let best = "";
  let bestScore = 0;
  for (let i = 0; i < chatHistory.length; i++) {
    const m = chatHistory[i]!;
    if (m.role !== "assistant") continue;
    const score = scoreStep1AssistantMessage(m.content) + i * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = m.content;
    }
  }
  if (best) return best;
  if (fallbackRaw.trim() && scoreStep1AssistantMessage(fallbackRaw) > 0) return fallbackRaw;
  return "";
}

export function coalesceAnalysisFromText(
  prev: ProductDesign["analysis"] | null | undefined,
  markdownText: string,
): ProductAnalysis | null {
  const fromMd = parseAnalysisFromMarkdown(markdownText);
  if (!fromMd) return hasValidAnalysis(prev) ? prev! : null;
  if (!hasValidAnalysis(prev)) return fromMd;
  return analysisRichness(fromMd) >= analysisRichness(prev!) ? fromMd : prev!;
}

/**
 * 展示层一律 **stored 优先**：`design` 是权威源。
 * 只有库里为空时才回落到聊天记录解析，避免用户在中间区的编辑被
 * 重新解析出的历史 Markdown 覆盖。
 */
export function resolveAnalysisForDisplay(project: {
  design: ProductDesign | null;
  chatHistory: Array<{ role: string; content: string }>;
}): ProductAnalysis | null {
  const stored = project.design?.analysis;
  if (hasValidAnalysis(stored)) return stored!;
  return parseAnalysisFromMarkdown(findStep1AssistantText(project.chatHistory));
}

export function resolveMainImagesForDisplay(project: {
  design: ProductDesign | null;
  chatHistory: Array<{ role: string; content: string }>;
}): ProductDesignMainImage[] {
  if (project.design?.selectedPlanNo == null) return [];
  if (!isStep3ReadyForDownstream(project)) return [];
  const stored = project.design?.mainImages ?? [];
  if (stored.length > 0) return stored;
  return coalesceMainImagesFromText([], findStep4AssistantText(project.chatHistory));
}

export function resolveDetailOutlineForDisplay(project: {
  design: ProductDesign | null;
  chatHistory: Array<{ role: string; content: string }>;
}): DetailOutlineRow[] {
  // 不再要求主图先产出：详情产线可独立进行
  if (project.design?.selectedPlanNo == null) return [];
  const stored = project.design?.detailOutline ?? [];
  if (stored.length > 0) return stored;
  return coalesceDetailOutlineFromText([], findStep7AssistantText(project.chatHistory));
}

export function sanitizeStep4MiddleMarkdown(raw: string): string {
  return sanitizeMiddlePanelMarkdown(raw, { stepNo: 4 });
}

export function sanitizeStep7MiddleMarkdown(raw: string): string {
  return sanitizeMiddlePanelMarkdown(raw, { stepNo: 7 });
}

export const DETAIL_OUTLINE_TAG_LABEL: Record<DetailOutlineRow["tag"], string> = {
  emotion: "情绪种草",
  proof: "价值证明",
  risk: "打消顾虑",
  other: "其他",
};
