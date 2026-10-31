const ITEM_START = /^\s*\d+\.\s/;
const CATEGORY_LINE = /^【(.+)】$/;
const RELEASE_WORD = /发布|上线|推出|开源/;
const MODEL_WORD =
  /模型|GPT|Claude|Gemini|Qwen|万相|可灵|Seedance|即梦|Sora|Flux|Midjourney|混元|文心|Kimi|DeepSeek|Llama|通义/;

type NewsItem = { lines: string[] };
type NewsSection = { title: string; header: string; items: NewsItem[] };

function isModelSection(title: string): boolean {
  return title.includes("模型发布");
}

function itemLooksLikeModelRelease(item: NewsItem): boolean {
  const text = item.lines.join("\n");
  return RELEASE_WORD.test(text) && MODEL_WORD.test(text);
}

function isFooterLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("*") && trimmed.endsWith("*")) return true;
  return trimmed.includes("由 AI 整理");
}

/** 免责声明挂在最后一条末尾；挪条目时拆下来，避免跟着模型发布跑到最前。 */
function peelTrailingFooter(item: NewsItem): string[] {
  const peeled: string[] = [];
  while (item.lines.length > 1) {
    const last = item.lines[item.lines.length - 1] ?? "";
    if (!isFooterLine(last)) break;
    peeled.unshift(item.lines.pop() as string);
  }
  return peeled.filter((line) => line.trim());
}

function parseSections(text: string): { head: string[]; sections: NewsSection[] } {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const head: string[] = [];
  const sections: NewsSection[] = [];
  let current: NewsSection | null = null;
  let item: NewsItem | null = null;

  for (const line of lines) {
    const title = line.trim().match(CATEGORY_LINE)?.[1];
    if (title) {
      current = { title, header: line, items: [] };
      sections.push(current);
      item = null;
      continue;
    }
    if (!current) {
      head.push(line);
      continue;
    }
    if (ITEM_START.test(line)) {
      item = { lines: [line] };
      current.items.push(item);
      continue;
    }
    if (item) item.lines.push(line);
    else if (line.trim()) {
      current.items.push({ lines: [line] });
    }
  }

  return { head, sections };
}

function itemKey(item: NewsItem): string {
  return (item.lines[0] ?? "").replace(ITEM_START, "").replace(/\*/g, "").replace(/\s+/g, "").trim();
}

function renumber(items: NewsItem[], start: number): { lines: string[]; next: number } {
  let n = start;
  const lines: string[] = [];
  for (const item of items) {
    const first = item.lines[0] ?? "";
    if (!ITEM_START.test(first)) {
      lines.push(...item.lines);
      continue;
    }
    n += 1;
    lines.push(first.replace(ITEM_START, `${n}. `));
    lines.push(...item.lines.slice(1));
  }
  return { lines, next: n };
}

/** 模型发布放到最前；其他板块里写了新模型上线的条目也归到这一块。 */
export function organizeAiNewsMarkdown(text: string): string {
  const { head, sections } = parseSections(text);
  if (sections.length === 0) return text.trim();

  const modelItems: NewsItem[] = [];
  const seenModel = new Set<string>();
  const rest: NewsSection[] = [];
  const footers: string[] = [];

  const takeModel = (item: NewsItem) => {
    const key = itemKey(item);
    if (key && seenModel.has(key)) return;
    if (key) seenModel.add(key);
    modelItems.push(item);
  };

  for (const section of sections) {
    for (const item of section.items) footers.push(...peelTrailingFooter(item));
    if (isModelSection(section.title)) {
      for (const item of section.items) takeModel(item);
      continue;
    }
    const stay: NewsItem[] = [];
    for (const item of section.items) {
      if (ITEM_START.test(item.lines[0] ?? "") && itemLooksLikeModelRelease(item)) takeModel(item);
      else stay.push(item);
    }
    if (stay.length > 0) rest.push({ ...section, items: stay });
  }

  const parts: string[] = [];
  const headText = head
    .filter((line) => !/模拟推演|重要提示|非真实|请勿作为投资|实际时间早于/.test(line))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
  if (headText) parts.push(headText);

  let next = 0;
  const flush = (header: string, items: NewsItem[]) => {
    if (items.length === 0) return;
    const body = renumber(items, next);
    next = body.next;
    parts.push([header, ...body.lines].join("\n"));
  };

  if (modelItems.length > 0) flush("【模型发布】", modelItems);
  for (const section of rest) {
    flush(section.header.trim() || `【${section.title}】`, section.items);
  }
  if (footers.length > 0) parts.push(footers.join("\n"));

  return parts.join("\n\n");
}

export function countAiNewsItems(text: string): number {
  return text.split("\n").filter((line) => ITEM_START.test(line)).length;
}

/** 折叠时至少展示 maxItems 条；模型发布条目全部保留，避免被「展开全部」挡住。 */
export function previewAiNewsMarkdown(text: string, maxItems: number): string {
  const organized = organizeAiNewsMarkdown(text);
  const lines = organized.split("\n");
  const itemStarts: number[] = [];
  let inModel = false;
  let modelItems = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const title = lines[i]?.trim().match(CATEGORY_LINE)?.[1];
    if (title) inModel = isModelSection(title);
    if (ITEM_START.test(lines[i] ?? "")) {
      itemStarts.push(i);
      if (inModel) modelItems += 1;
    }
  }
  if (itemStarts.length <= maxItems) return organized;

  const keep = Math.min(itemStarts.length, Math.max(maxItems, modelItems));
  if (keep >= itemStarts.length) return organized;
  const preview = lines.slice(0, itemStarts[keep]);
  while (preview.length > 0 && !preview[preview.length - 1]?.trim()) preview.pop();
  return preview.join("\n");
}
