/** 解析 GFM 表格为行对象（首行作表头）。 */

import {
  STORY_PRO2_CHARACTER_TABLE_HEADER,
  STORY_PRO2_SCENE_TABLE_HEADER,
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
  STORY_PRO2_STORYBOARD_TABLE_HEADER_V1,
  STORY_PRO2_HANDOFF_TABLE_HEADER,
} from "./data/pro2-production-pack-standard";
import { stripPro2AnchorPlaceholders } from "./pro2-chinese-prompt-normalize";

export type MdTableRow = Record<string, string>;

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function pickColumn(row: MdTableRow, aliases: string[]): string {
  for (const alias of aliases) {
    const na = normHeader(alias);
    for (const [key, val] of Object.entries(row)) {
      if (normHeader(key) === na) {
        return stripInlineMarkdownCell(val);
      }
    }
  }
  for (const alias of aliases) {
    if (/^[a-z]{1,4}$/i.test(alias)) continue;
    const na = normHeader(alias);
    for (const [key, val] of Object.entries(row)) {
      const nk = normHeader(key);
      if (nk.includes(na)) {
        return stripInlineMarkdownCell(val);
      }
    }
  }
  return "";
}

/** 表格编辑/展示用：去掉 Markdown 行内格式与过度转义 */
function stripInlineMarkdownCell(text: string): string {
  let s = text.trim();
  for (let i = 0; i < 4; i++) {
    const next = s.replace(/\\([\\*_|[\]])/g, "$1");
    if (next === s) break;
    s = next;
  }
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  return s.trim();
}

function parseGfmTableRowCells(line: string, unescape = false): string[] | null {
  const t = normalizeMdTableLine(line);
  if (!t.startsWith("|")) return null;
  const inner = t.replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((c) => {
    const cell = c.trim();
    return unescape ? unescapeGfmTableCell(cell) : cell;
  });
}

function unescapeGfmTableCell(cell: string): string {
  let s = cell;
  for (let i = 0; i < 4; i++) {
    const next = s.replace(/\\([\\*_|[\]])/g, "$1");
    if (next === s) break;
    s = next;
  }
  return s;
}

function isGfmTableSeparatorLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && /^[\|\s\-:]+$/.test(t);
}

function stripInvisibleMdPrefix(line: string): string {
  return line
    .replace(/^\uFEFF/, "")
    .replace(/^[\u200B\u200C\u200D\uFEFF]+/, "");
}

function normalizeMdTableLine(line: string): string {
  return stripInvisibleMdPrefix(line).trim().replace(/\uFF5C/g, "|");
}

function countUnescapedPipes(line: string): number {
  let n = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "|" && (i === 0 || line[i - 1] !== "\\")) n++;
  }
  return n;
}

/** 行是否像完整的 GFM 表格行（首尾 | 且至少 2 个分隔符） */
function isCompleteGfmTableRow(line: string): boolean {
  const t = normalizeMdTableLine(line);
  return t.startsWith("|") && t.endsWith("|") && countUnescapedPipes(t) >= 2;
}

/**
 * 将 LLM 常输出的「单元格内换行 / 续行无 leading |」合并为单行 GFM 行。
 * 单元格内换行保留为 <br>，供 HTML 预览渲染。
 */
export function joinMultilineGfmTableRows(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i]!;
    const t = normalizeMdTableLine(raw);
    if (!t.startsWith("|")) {
      out.push(raw);
      i++;
      continue;
    }

    const tableRows: string[] = [];
    let row = t;
    i++;

    while (i < lines.length) {
      const nt = normalizeMdTableLine(lines[i]!);
      if (!nt) {
        let j = i + 1;
        while (j < lines.length && !normalizeMdTableLine(lines[j]!)) j++;
        const peek = j < lines.length ? normalizeMdTableLine(lines[j]!) : "";
        if (peek.startsWith("|")) {
          i++;
          continue;
        }
        break;
      }

      if (nt.startsWith("|") && isCompleteGfmTableRow(row)) {
        tableRows.push(row);
        row = nt;
        i++;
        continue;
      }

      if (!row.endsWith("|")) {
        row = `${row} ${nt}`;
      } else {
        const lastPipe = row.lastIndexOf("|");
        const prefix = row.slice(0, lastPipe).trimEnd();
        const suffix = row.slice(lastPipe);
        const cellTail = nt.startsWith("|") ? nt.slice(1).trimStart() : nt;
        row = `${prefix}<br>${cellTail}${suffix === "|" ? "" : suffix}`;
      }
      i++;
    }

    if (row.trim()) tableRows.push(row);
    out.push(...tableRows);
  }

  return out.join("\n");
}

/** 转义单元格内会破坏 GFM 表格解析的 Markdown 符号（如 _teen boy 触发强调） */
function escapeGfmTableCell(cell: string): string {
  return cell
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[");
}

function formatGfmTableRow(cells: string[]): string {
  return `| ${cells.map(escapeGfmTableCell).join(" | ")} |`;
}

function parseMdTableLines(
  normalized: string,
  opts?: { unescapeCells?: boolean },
): { headers: string[]; rows: MdTableRow[] } {
  const unescape = opts?.unescapeCells ?? false;
  const lines = normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex(
    (l) => l.startsWith("|") && !/^[\|\s\-:]+$/.test(l),
  );
  if (headerIdx < 0) return { headers: [], rows: [] };

  const headerCells = parseGfmTableRowCells(lines[headerIdx]!, unescape);
  if (!headerCells?.length) return { headers: [], rows: [] };
  const headers = headerCells;

  const rows: MdTableRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.startsWith("|")) break;
    if (/^[\|\s\-:]+$/.test(line)) continue;
    const cells = parseGfmTableRowCells(line, unescape);
    if (!cells) break;
    const row: MdTableRow = {};
    headers.forEach((h, j) => {
      row[h] = cells[j] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

export function parseMdTable(md: string): { headers: string[]; rows: MdTableRow[] } {
  return parseMdTableLines(prepareMarkdownForTableParse(md));
}

/** 预览表格解析（不转义单元格，供 HTML 表格渲染） */
export function parseMdTableDisplay(md: string): { headers: string[]; rows: MdTableRow[] } {
  return parseMdTableLines(prepareMarkdownForPreview(md), { unescapeCells: true });
}

/** 从段落正文解析角色（GFM 表 · 列表 · 「角色名 · …」行） */
export function parseCharacterListFromSection(body: string): Array<{
  name: string;
  role: string;
  appearance: string;
  personality: string;
}> {
  const fromTable = parseCharacterRows(body);
  if (fromTable.length) return fromTable;

  const out: Array<{
    name: string;
    role: string;
    appearance: string;
    personality: string;
  }> = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.replace(/^[-*•]\s+/, "");
    if (bullet === line && !/^角色名/m.test(line)) continue;
    const src = bullet === line ? line : bullet;
    const parts = src.split(/[·•|｜]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 1) continue;
    const name = parts[0]!.replace(/^角色名\s*/i, "").trim();
    if (!name || name.length > 40) continue;
    out.push({
      name,
      role: parts[1] ?? "",
      appearance: parts.slice(2).join(" · ") || parts[1] || "（待补充外观）",
      personality: "",
    });
  }
  return out;
}

/** 从分镜对白推断说话角色（「林晨：」） */
export function inferCharacterNamesFromStoryboard(md: string): string[] {
  const names = new Set<string>();
  for (const row of parseStoryboardRows(md)) {
    const d = row.dialogue.trim();
    if (!d) continue;
    const m = d.match(/^([^：:\(（\n]{1,24})[：:(（]/);
    if (m?.[1]?.trim()) names.add(m[1].trim());
  }
  return Array.from(names);
}

/** 角色表 → 三视图批量数据 */
export function parseCharacterRows(md: string): Array<{
  name: string;
  role: string;
  appearance: string;
  personality: string;
  aiImagePrompt: string;
}> {
  const { rows } = parseMdTable(md);
  return rows
    .map((r) => {
      const name = pickColumn(r, [
        "姓名",
        "角色",
        "name",
        "character",
        "角色名",
        "character name",
      ]);
      const role = pickColumn(r, [
        "定位",
        "role",
        "角色定位",
        "身份",
        "类型",
        "身份说明",
        "剧情背景",
        "背景",
        "description",
      ]);
      const appearance = pickColumn(r, [
        "外貌关键词",
        "AI生图关键标签",
        "AI 生图关键标签",
        "生图关键标签",
        "外貌/服装/标志性动作",
        "外观描述",
        "appearance",
        "描述",
        "appearance description",
        "外观",
        "visual",
        "外貌",
      ]);
      const personality = pickColumn(r, [
        "性格",
        "personality",
        "性格特点",
        "个性",
      ]);
      const aiImagePrompt = pickColumn(r, [
        "ai生图提示词(英文)",
        "ai生图提示词",
        "ai image prompt",
        "image prompt",
      ]);
      return {
        name: stripPro2AnchorPlaceholders(name),
        role: stripPro2AnchorPlaceholders(role),
        appearance: stripPro2AnchorPlaceholders(appearance),
        personality: stripPro2AnchorPlaceholders(personality),
        aiImagePrompt,
      };
    })
    .map((c) => ({
      ...c,
      appearance:
        c.appearance.trim() ||
        (c.role.trim() ? `（待补充外观）${c.role}` : "（待补充外观）"),
    }))
    .filter((c) => c.name.trim());
}

/** 将任意可解析的角色表规范为 GFM 四列表 */
export function normalizeCharacterTableMd(md: string): string {
  const rows = parseCharacterRows(md);
  if (!rows.length) return md.trim();
  return formatCharacterTableMarkdown(rows);
}

/** 从大纲 Markdown 中移除「人物表（简要）」及文末仅含「定位」的简表（展示/落库用） */
export function stripOutlineCharacterTable(md: string): string {
  let s = md.trim();
  if (!s) return "";
  s = s
    .replace(/\n?##\s*人物表[^\n]*\n[\s\S]*?(?=\n##\s|\n#\s|$)/gi, "")
    .trim();
  const lines = s.split(/\r?\n/);
  let lastTableStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith("|") || /^[\|\s\-:]+$/.test(t)) continue;
    const sep = lines[i + 1]?.trim() ?? "";
    if (sep && /^[\|\s\-:]+$/.test(sep)) lastTableStart = i;
  }
  if (lastTableStart < 0) return s.replace(/\n{3,}/g, "\n\n").trim();
  const chunk = lines.slice(lastTableStart).join("\n");
  const { headers } = parseMdTable(chunk);
  const hasRole = headers.some((h) => {
    const nk = normHeader(h);
    return nk === "定位" || nk === "role";
  });
  const hasAppearance = headers.some((h) => {
    const nk = normHeader(h);
    return nk.includes("外观") || nk === "appearance" || nk === "visual";
  });
  if (hasRole && !hasAppearance) {
    s = lines.slice(0, lastTableStart).join("\n").trim();
  }
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/** 合并两段定位文案时，优先保留更完整的一句（避免短标签覆盖长说明） */
export function preferDetailedRole(primary: string, secondary: string): string {
  const a = primary.trim();
  const b = secondary.trim();
  if (!a) return b;
  if (!b) return a;
  const shortLen = 14;
  const aShort = a.length <= shortLen;
  const bShort = b.length <= shortLen;
  if (aShort && !bShort) return b;
  if (bShort && !aShort) return a;
  return a.length >= b.length ? a : b;
}

function escapeMdTableCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

/** 任意 GFM 表 → Markdown（与角色/分镜表同款转义，供大纲块编辑写回） */
export function formatGenericGfmTableMarkdown(
  headers: string[],
  rows: MdTableRow[],
): string {
  if (!headers.length) return "";
  const lines = [
    `| ${headers.map((h) => h.trim()).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map(
      (row) =>
        `| ${headers.map((h) => escapeMdTableCell(row[h] ?? "")).join(" | ")} |`,
    ),
  ];
  return lines.join("\n");
}

/** 大纲块编辑 · 合并正文段与表格段 */
export function joinMarkdownBlocks(blocks: MarkdownBlock[]): string {
  return blocks
    .map((b) => b.value.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function formatCharacterTableMarkdown(
  rows: Array<{
    name: string;
    role: string;
    appearance: string;
    personality?: string;
    aiImagePrompt?: string;
  }>,
): string {
  if (!rows.length) return "";
  const headerLines = STORY_PRO2_CHARACTER_TABLE_HEADER.split("\n");
  return [
    headerLines[0] ?? "",
    headerLines[1] ?? "",
    ...rows.map(
      (r) =>
        `| ${escapeMdTableCell(r.name)} | ${escapeMdTableCell(r.role)} | ${escapeMdTableCell(r.appearance)} | ${escapeMdTableCell(r.personality ?? "")} | ${escapeMdTableCell(r.aiImagePrompt ?? "")} |`,
    ),
  ].join("\n");
}

/** 将大纲人物表中的「定位」写入角色设定表（保留已有外观描述） */
export function mergeOutlineRolesIntoCharacterMd(
  characterMd: string,
  brief: Array<{ name: string; role: string; appearance: string }>,
): string {
  if (!brief.length) return characterMd;
  const existing = parseCharacterRows(characterMd);
  const byName = new Map(existing.map((c) => [c.name, c]));
  const merged: Array<{
    name: string;
    role: string;
    appearance: string;
    personality?: string;
  }> = [];
  const seen = new Set<string>();
  for (const b of brief) {
    if (!b.name.trim()) continue;
    seen.add(b.name);
    const e = byName.get(b.name);
    const role = preferDetailedRole(b.role, e?.role ?? "");
    const appearance =
      e?.appearance?.trim() && !e.appearance.startsWith("（待补充")
        ? e.appearance
        : b.appearance?.trim() || "（待补充外观）";
    merged.push({
      name: b.name,
      role,
      appearance,
      personality: e?.personality,
    });
  }
  for (const e of existing) {
    if (!seen.has(e.name)) {
      merged.push({
        ...e,
        role: preferDetailedRole(e.role, ""),
      });
    }
  }
  return formatCharacterTableMarkdown(merged);
}

/** 解析人物表 → 剥离大纲正文 → 合并定位到角色设定 */
export function normalizeOutlineSection(
  outlineRaw: string,
  characterMd: string,
): { outlineMd: string; characterMd: string } {
  const brief = parseOutlineBriefCharacters(outlineRaw);
  return {
    outlineMd: stripOutlineCharacterTable(outlineRaw),
    characterMd: mergeOutlineRolesIntoCharacterMd(characterMd, brief),
  };
}

/** 去掉 GFM 表格行之间的空行（避免预览/解析在中间截断） */
export function compactGfmTables(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inTable = false;
  for (const line of lines) {
    const t = line.trim().replace(/\uFF5C/g, "|");
    const isPipe = t.startsWith("|");
    if (isPipe) {
      inTable = true;
      out.push(line);
      continue;
    }
    if (inTable && !t) continue;
    inTable = false;
    out.push(line);
  }
  return out.join("\n");
}

/**
 * 修复预览用 GFM 表格：补分隔行、统一列数、转义单元格内 _*|[] 等。
 */
export function repairGfmTablesForPreview(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const cells = parseGfmTableRowCells(line);
    if (!cells || isGfmTableSeparatorLine(line)) {
      out.push(line);
      i++;
      continue;
    }

    const colCount = cells.length;
    const block: string[] = [formatGfmTableRow(cells)];
    i++;

    if (i < lines.length && isGfmTableSeparatorLine(lines[i]!)) {
      block.push(formatGfmTableRow(Array.from({ length: colCount }, () => "---")));
      i++;
    } else if (i < lines.length && parseGfmTableRowCells(lines[i]!)) {
      block.push(formatGfmTableRow(Array.from({ length: colCount }, () => "---")));
    }

    while (i < lines.length) {
      const bodyCells = parseGfmTableRowCells(lines[i]!);
      if (!bodyCells || isGfmTableSeparatorLine(lines[i]!)) break;
      let normalized = bodyCells;
      if (normalized.length > colCount) {
        normalized = [
          ...normalized.slice(0, colCount - 1),
          normalized.slice(colCount - 1).join(" | "),
        ];
      } else {
        while (normalized.length < colCount) normalized.push("");
      }
      block.push(formatGfmTableRow(normalized));
      i++;
    }

    out.push(...block);
  }
  return out.join("\n");
}

export type MarkdownBlock =
  | { kind: "text"; value: string }
  | { kind: "table"; value: string };

/** 将 Markdown 拆成正文段与 GFM 表格段（供审阅预览逐段渲染） */
export function splitMarkdownByGfmTables(md: string): MarkdownBlock[] {
  const lines = md.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let buf: string[] = [];
  let inTable = false;

  const flush = () => {
    const value = buf.join("\n").trim();
    if (value) blocks.push({ kind: inTable ? "table" : "text", value });
    buf = [];
  };

  const isPipeStart = (line: string) => normalizeMdTableLine(line).startsWith("|");

  const isTableContinuation = (line: string): boolean => {
    if (!inTable || !buf.length) return false;
    const t = line.trim();
    if (/^#{1,6}\s/.test(t)) return false;
    if (!t) return true;
    const prev = normalizeMdTableLine(buf[buf.length - 1]!);
    if (!prev.startsWith("|")) return false;
    if (isPipeStart(line) && isCompleteGfmTableRow(prev)) return false;
    return true;
  };

  for (const line of lines) {
    const pipeStart = isPipeStart(line);
    const continuation = isTableContinuation(line);

    if (pipeStart || continuation) {
      if (!inTable && pipeStart) {
        flush();
        inTable = true;
      }
      if (inTable) {
        buf.push(line);
        continue;
      }
    }

    if (inTable) {
      flush();
      inTable = false;
    }
    buf.push(line);
  }
  flush();
  return blocks;
}

/** 将「## 标题 | 列1 | 列2 |」或「标题 | 列1 | 列2 |」拆成标题 + 独立表头行 */
function splitHeadingEmbeddedTableHeaders(md: string): string {
  const out: string[] = [];
  for (const raw of md.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t) {
      out.push("");
      continue;
    }
    const headingTable = t.match(/^(#{1,6}\s+)(.+?)\s+(\|[^#].+\|)\s*$/);
    if (headingTable) {
      out.push(`${headingTable[1]}${headingTable[2].trim()}`);
      out.push("");
      out.push(headingTable[3]!.trim());
      continue;
    }
    const titleTable = t.match(/^([^#|][^|]{0,48}?)\s+(\|(?:[^|\n]+\|)+)\s*$/);
    if (titleTable && (titleTable[2]!.match(/\|/g) ?? []).length >= 3) {
      out.push(`## ${titleTable[1]!.trim()}`);
      out.push("");
      out.push(titleTable[2]!.trim());
      continue;
    }
    out.push(raw);
  }
  return out.join("\n");
}

function ensureMarkdownBlockSpacing(md: string): string {
  return md.replace(/([^\n|])\n(#{1,6}\s)/g, "$1\n\n$2");
}

/** 将「| 列1 | 列2 ||---|---|」同一行拆成表头 + 分隔行（LLM/手误常见） */
function splitMergedGfmTableHeaderSeparator(md: string): string {
  const out: string[] = [];
  for (const raw of md.split(/\r?\n/)) {
    const t = normalizeMdTableLine(raw);
    if (t.startsWith("|") && t.includes("||")) {
      const idx = t.indexOf("||");
      const header = t.slice(0, idx + 1).trimEnd();
      let sep = t.slice(idx + 2).trim();
      if (sep && !sep.startsWith("|")) sep = `|${sep}`;
      if (header.startsWith("|") && sep.startsWith("|")) {
        out.push(header);
        out.push(sep);
        continue;
      }
    }
    out.push(raw);
  }
  return out.join("\n");
}

/** 预览用：合并换行 / 紧凑表格 / 标题与表格间补空行（不转义，交给 remark-gfm 渲染） */
export function prepareMarkdownForPreview(md: string): string {
  return prepareMarkdownTableStructure(md, { convertBrToNewline: true });
}

function unescapeOverEscapedMarkdown(md: string): string {
  let s = md;
  for (let i = 0; i < 4; i++) {
    const next = s.replace(/\\([\\*_|[\]])/g, "$1");
    if (next === s) break;
    s = next;
  }
  return s;
}

function prepareMarkdownTableStructure(
  md: string,
  opts: { convertBrToNewline: boolean },
): string {
  let s = md.replace(/\uFF5C/g, "|").trim();
  s = unescapeOverEscapedMarkdown(s);
  s = splitHeadingEmbeddedTableHeaders(s);
  s = splitMergedGfmTableHeaderSeparator(s);
  s = joinMultilineGfmTableRows(s);
  s = compactGfmTables(s);
  s = repairGfmTablesForPreview(s);
  if (!s) return "";
  if (opts.convertBrToNewline) {
    s = s.replace(/<br\s*\/?>/gi, "  \n");
  }
  s = ensureMarkdownBlockSpacing(s);
  s = s.replace(/(^|\n)(#{1,6}[^\n]+)\n(?!\n)(\|)/gm, "$1$2\n\n$3");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/** 解析 GFM 表格行对象用（含转义修复，勿用于 Markdown 预览） */
export function prepareMarkdownForTableParse(md: string): string {
  // 解析路径禁止把 <br> 换成物理换行，否则单元格内断行会被当成新表格行/截断，多镜表塌成一行
  return repairGfmTablesForPreview(
    prepareMarkdownTableStructure(md, { convertBrToNewline: false }),
  );
}

function extractMarkdownSectionByHeader(
  md: string,
  titlePattern: RegExp,
): string {
  return extractMarkdownSectionByHeaderLevels(md, titlePattern, [2]);
}

/** 按标题层级（## / ### / #）提取 Markdown 段落 */
export function extractMarkdownSectionByHeaderLevels(
  md: string,
  titlePattern: RegExp,
  levels: number[],
): string {
  for (const level of levels) {
    const re = new RegExp(`^#{${level}}\\s+(.+)$`, "gm");
    let match: RegExpExecArray | null;
    const hits: Array<{ start: number; end: number; title: string }> = [];
    while ((match = re.exec(md)) !== null) {
      hits.push({
        start: match.index,
        end: match.index + match[0].length,
        title: match[1]?.trim() ?? "",
      });
    }
    const idx = hits.findIndex((h) => titlePattern.test(h.title));
    if (idx < 0) continue;
    const bodyStart = hits[idx].end;
    const bodyEnd = idx + 1 < hits.length ? hits[idx + 1].start : md.length;
    const body = md.slice(bodyStart, bodyEnd).trim();
    if (body) return body;
  }
  return extractPlainTextSectionByHeader(md, titlePattern);
}

const PRO2_HUMAN_SECTION_TITLE =
  /^(?:视觉风格总纲|场景视觉辞典|核心冲突与结构摘要|角色视觉辞典|分镜脚本|下一步交接清单)$/;

function isPro2HumanSectionTitleLine(line: string): boolean {
  const t = line.trim();
  return PRO2_HUMAN_SECTION_TITLE.test(t) && !t.includes("\t");
}

function parseTabTableBlockAt(
  lines: string[],
  startIdx: number,
): { table: string; nextIdx: number } | null {
  const headerLine = lines[startIdx]?.trim() ?? "";
  if (!headerLine.includes("\t")) return null;
  const headers = headerLine.split("\t").map((s) => s.trim());
  if (headers.length < 2) return null;
  const colCount = headers.length;
  const dataRows: string[][] = [];
  let i = startIdx + 1;

  while (i < lines.length) {
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();

    if (!trimmed) {
      const next = lines[i + 1]?.trim() ?? "";
      if (
        next &&
        (isPro2HumanSectionTitleLine(next) ||
          (next.startsWith("##") && !next.includes("\t")) ||
          next.startsWith("{"))
      ) {
        break;
      }
      i++;
      continue;
    }

    if (
      (isPro2HumanSectionTitleLine(trimmed) ||
        (trimmed.startsWith("##") && !trimmed.includes("\t"))) &&
      !trimmed.includes("\t")
    ) {
      break;
    }
    if (trimmed.startsWith("{")) break;

    if (trimmed.includes("\t")) {
      const cells = trimmed.split("\t").map((s) => s.trim());
      const row = [...cells];
      while (row.length < colCount) row.push("");
      dataRows.push(row.slice(0, colCount));
      i++;
      continue;
    }

    if (!dataRows.length) break;
    const last = dataRows[dataRows.length - 1]!;
    let targetCol = colCount - 1;
    for (let c = colCount - 1; c >= 0; c--) {
      if (last[c]?.trim()) {
        targetCol = c;
        break;
      }
    }
    last[targetCol] = `${last[targetCol] ?? ""}\n${raw}`.trim();
    i++;
  }

  if (!dataRows.length) return null;
  const rows: MdTableRow[] = dataRows.map((cells) => {
    const row: MdTableRow = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    return row;
  });
  return {
    table: formatGenericGfmTableMarkdown(headers, rows),
    nextIdx: i,
  };
}

/** LLM 人读段（Tab 分隔表 · 支持单元格内换行）→ GFM */
export function convertPro2HumanTabMarkdownToGfm(md: string): string {
  const raw = md.trim();
  if (!raw) return raw;

  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      out.push("");
      i++;
      continue;
    }

    const parsed = parseTabTableBlockAt(lines, i);
    if (parsed) {
      out.push(parsed.table);
      i = parsed.nextIdx;
      continue;
    }

    if (isPro2HumanSectionTitleLine(trimmed) && !trimmed.startsWith("##")) {
      out.push(`## ${trimmed}`);
      i++;
      continue;
    }

    out.push(line);
    i++;
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** 人读 GFM · 大纲 Tab 展示（保留视觉/冲突/角色/场景/交接 · 去掉分镜） */
export function extractPro2OutlineDisplayMdFromHumanGfm(gfm: string): string {
  const lines = gfm.split(/\r?\n/);
  const out: string[] = [];
  let skipStoryboard = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^##\s*分镜脚本/i.test(t)) {
      skipStoryboard = true;
      continue;
    }
    if (skipStoryboard) {
      if (/^##\s+/.test(t)) skipStoryboard = false;
      else continue;
    }
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** 人读 GFM → Hub 各 Tab Markdown（对齐 docs/画布大模型代码解析.md · 保留原表） */
export function promotePro2HumanGfmToHubFields(gfm: string): {
  outlineMd: string;
  characterMd: string;
  sceneMd: string;
  storyboardMd: string;
} {
  return {
    outlineMd: extractPro2OutlineDisplayMdFromHumanGfm(gfm),
    characterMd: extractCharacterSectionFromOutline(gfm),
    sceneMd: resolveSceneDictionaryMarkdown(gfm, ""),
    storyboardMd: extractPro2HumanStoryboardMd(gfm),
  };
}

const PLAIN_SECTION_TITLE =
  /^(?:视觉风格总纲|场景视觉辞典|核心冲突与结构摘要|角色视觉辞典|分镜脚本|下一步交接清单)/;

/** result.md 风格：无 ## 的纯文本章节标题 */
function extractPlainTextSectionByHeader(
  md: string,
  titlePattern: RegExp,
): string {
  const lines = md.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const title = lines[i]?.trim() ?? "";
    if (!title || title.startsWith("#") || title.startsWith("|")) continue;
    if (!titlePattern.test(title)) continue;
    const bodyLines: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const raw = lines[j] ?? "";
      const nt = raw.trim();
      if (nt.startsWith("##")) break;
      if (
        nt &&
        !nt.startsWith("|") &&
        PLAIN_SECTION_TITLE.test(nt) &&
        !titlePattern.test(nt)
      ) {
        break;
      }
      bodyLines.push(raw);
    }
    const body = bodyLines.join("\n").trim();
    if (body) return body;
  }
  return "";
}

function sceneDictionaryHeadersMatch(headers: string[]): boolean {
  const norms = headers.map(normHeader);
  const hasSceneName = norms.some(
    (h) =>
      h === "场景名" ||
      h === "场景" ||
      h.includes("scene name") ||
      h === "scene" ||
      h === "location",
  );
  const hasCanonicalMerged = norms.some((h) =>
    h.includes("环境/时间/气氛"),
  );
  const hasSceneMeta = norms.some((h) =>
    ["环境", "时间", "气氛", "氛围", "environment", "time", "mood", "atmosphere"].some(
      (alias) => h === alias || h.includes(alias),
    ),
  );
  const hasImageKw = norms.some((h) =>
    h.includes("生图关键词") || h.includes("image"),
  );
  return hasSceneName && (hasCanonicalMerged || hasSceneMeta || hasImageKw);
}

/** 无 ## 场景视觉辞典 标题时，按表头扫描全文 GFM 场景辞典表 */
function findSceneVisualDictionaryTableBlock(md: string): string {
  const lines = md.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const t = normalizeMdTableLine(lines[i]!);
    if (!t.startsWith("|") || /^[\|\s\-:]+$/.test(t)) continue;
    const headerCells = parseGfmTableRowCells(t);
    if (!headerCells?.length) continue;
    const block: string[] = [lines[i]!];
    let j = i + 1;
    while (j < lines.length) {
      const nt = normalizeMdTableLine(lines[j]!);
      if (!nt.startsWith("|")) break;
      block.push(lines[j]!);
      j++;
    }
    const blockMd = compactGfmTables(block.join("\n"));
    const { headers, rows } = parseMdTable(blockMd);
    if (headers.length && rows.length && sceneDictionaryHeadersMatch(headers)) {
      return blockMd;
    }
    i = Math.max(i, j - 1);
  }
  return "";
}

/** 大纲展示：去掉快手版「制作包」嵌入段（角色设定卡 / 关系 / 分镜 / 核心对白），保留影视专业版「二、主要角色」等章节 */
export function stripOutlineEmbeddedPackSections(md: string): string {
  let s = stripOutlineCharacterTable(md);
  s = s.replace(
    /\n##\s*(?:角色设定|角色设定卡|角色关系(?:描述)?|角色视觉辞典|主要人物|主要角色|人物表|分镜脚本|分镜表|核心对白)[^\n]*\n[\s\S]*?(?=\n##\s|$)/gi,
    "",
  ).trim();
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

export type SceneVisualDictionaryRow = {
  name: string;
  /** canonical · 环境/时间/气氛 合并列 */
  envTimeMood?: string;
  environment: string;
  time: string;
  mood: string;
  imageKeywords: string;
  negativePrompt?: string;
};

function sceneEnvTimeMoodDisplay(row: SceneVisualDictionaryRow): string {
  const merged = row.envTimeMood?.trim();
  if (merged) return merged;
  return [row.environment, row.time, row.mood].filter(Boolean).join(" · ");
}

function parseSceneDictionaryRowFromMd(r: MdTableRow): SceneVisualDictionaryRow | null {
  const name =
    pickColumn(r, ["场景名", "场景", "scene name", "scene", "location", "name"]) ||
    "";
  if (!name.trim()) return null;
  const envTimeMood = pickColumn(r, [
    "环境/时间/气氛",
    "环境时间气氛",
  ]);
  const environment =
    pickColumn(r, ["环境", "environment", "env"]) || envTimeMood;
  const time = pickColumn(r, ["时间", "time", "timeofday"]);
  const mood = pickColumn(r, ["气氛", "氛围", "mood", "atmosphere"]);
  const sceneDesc = pickColumn(r, ["场景描述", "描述", "description"]);
  const imageKeywords = pickColumn(r, [
    "生图关键词(英文)",
    "生图关键词",
    "生成图片关键词",
    "关键词",
    "ai生图提示词(英文)",
    "ai生图提示词",
    "image prompt",
    "image keywords",
    "prompt",
  ]) || sceneDesc;
  const negativePrompt = pickColumn(r, [
    "固定反向提示词",
    "反向提示词",
    "negative prompt",
    "negative",
  ]);
  return {
    name: name.trim(),
    envTimeMood: envTimeMood || undefined,
    environment,
    time,
    mood,
    imageKeywords,
    negativePrompt: negativePrompt || undefined,
  };
}

export function formatSceneDictionaryTableMarkdown(
  rows: SceneVisualDictionaryRow[],
): string {
  if (!rows.length) return "";
  const headerLines = STORY_PRO2_SCENE_TABLE_HEADER.split("\n");
  return [
    headerLines[0] ?? "",
    headerLines[1] ?? "",
    ...rows.map(
      (r) =>
        `| ${escapeMdTableCell(r.name)} | ${escapeMdTableCell(sceneEnvTimeMoodDisplay(r))} | ${escapeMdTableCell(r.imageKeywords)} | ${escapeMdTableCell(r.negativePrompt ?? "")} |`,
    ),
  ].join("\n");
}

/** 从大纲或场景段正文中提取场景 GFM 表 */
export function extractSceneSectionMd(md: string): string {
  const fromPrompt = extractMarkdownSectionByHeaderLevels(
    md,
    /场景视觉提示词/,
    [2, 3, 1],
  );
  if (fromPrompt) return compactGfmTables(fromPrompt);
  return extractSceneVisualDictionaryFromOutline(md);
}

function sceneDictRowScore(row: SceneVisualDictionaryRow): number {
  let score = 0;
  if (row.envTimeMood?.trim()) score += 2;
  if (row.environment?.trim()) score += 1;
  if (row.time?.trim()) score += 1;
  if (row.mood?.trim()) score += 1;
  if (row.imageKeywords?.trim()) score += 4;
  if (row.negativePrompt?.trim()) score += 2;
  return score;
}

/** 按场景名合并大纲辞典与场景段扩写表，优先保留非空生图关键词 */
export function mergeSceneVisualDictionaryRows(
  primary: SceneVisualDictionaryRow[],
  secondary: SceneVisualDictionaryRow[],
): SceneVisualDictionaryRow[] {
  const byName = new Map<string, SceneVisualDictionaryRow>();
  const mergePair = (
    a: SceneVisualDictionaryRow,
    b: SceneVisualDictionaryRow,
  ): SceneVisualDictionaryRow => ({
    name: a.name || b.name,
    envTimeMood: a.envTimeMood?.trim() || b.envTimeMood?.trim() || undefined,
    environment: a.environment?.trim() || b.environment?.trim() || "",
    time: a.time?.trim() || b.time?.trim() || "",
    mood: a.mood?.trim() || b.mood?.trim() || "",
    imageKeywords:
      a.imageKeywords?.trim() || b.imageKeywords?.trim() || "",
    negativePrompt:
      a.negativePrompt?.trim() || b.negativePrompt?.trim() || undefined,
  });
  for (const row of primary) {
    if (!row.name.trim()) continue;
    byName.set(row.name.trim(), row);
  }
  for (const row of secondary) {
    if (!row.name.trim()) continue;
    const prev = byName.get(row.name.trim());
    if (!prev) {
      byName.set(row.name.trim(), row);
      continue;
    }
    const merged = mergePair(prev, row);
    byName.set(
      row.name.trim(),
      sceneDictRowScore(row) > sceneDictRowScore(prev) ? merged : mergePair(row, prev),
    );
  }
  return Array.from(byName.values());
}

/** 解析 LLM「场景视觉提示词」段（sceneMd） */
export function parseScenePromptSectionRows(md: string): SceneVisualDictionaryRow[] {
  const section = extractMarkdownSectionByHeaderLevels(
    md ?? "",
    /场景视觉提示词/,
    [2, 3, 1],
  );
  if (!section.trim()) return [];
  const { rows } = parseMdTable(compactGfmTables(section));
  const out: SceneVisualDictionaryRow[] = [];
  for (const r of rows) {
    const parsed = parseSceneDictionaryRowFromMd(r);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** 合并大纲场景辞典 + sceneMd 扩写段，供预览 / 生成场景图弹层使用 */
export function resolveMergedSceneVisualDictionaryRows(
  outlineMd: string,
  sceneMd = "",
): SceneVisualDictionaryRow[] {
  const outlineSection =
    extractSceneVisualDictionaryFromOutline(outlineMd ?? "") ||
    extractSceneSectionMd(outlineMd ?? "");
  const fromOutline = outlineSection.trim()
    ? parseSceneVisualDictionaryRows(outlineSection)
    : parseSceneVisualDictionaryRows(outlineMd ?? "");
  const fromSceneMd = parseScenePromptSectionRows(sceneMd);
  if (!fromOutline.length && !fromSceneMd.length) return [];
  if (!fromOutline.length) return fromSceneMd;
  if (!fromSceneMd.length) return fromOutline;
  return mergeSceneVisualDictionaryRows(fromOutline, fromSceneMd);
}

/** 优先可解析的 sceneMd，否则从大纲拆出场景辞典 */
export function resolveSceneDictionaryMarkdown(
  outlineMd: string,
  sceneMd = "",
): string {
  const merged = resolveMergedSceneVisualDictionaryRows(outlineMd, sceneMd);
  if (!merged.length) {
    const dedicated = sceneMd.trim();
    if (dedicated && parseSceneVisualDictionaryRows(dedicated).length > 0) {
      return dedicated;
    }
    const fromOutline = extractSceneSectionMd(outlineMd);
    if (fromOutline.trim()) return fromOutline;
    return dedicated;
  }
  const header =
    STORY_PRO2_SCENE_TABLE_HEADER;
  const body = merged
    .map(
      (r) =>
        `| ${r.name} | ${sceneEnvTimeMoodDisplay(r)} | ${r.imageKeywords} | ${r.negativePrompt ?? ""} |`,
    )
    .join("\n");
  return `${header}${body}`;
}

/** 解析「场景视觉辞典」GFM 表 */
export function parseSceneVisualDictionaryRows(md: string): SceneVisualDictionaryRow[] {
  const section = extractSceneSectionMd(md);
  if (!section.trim()) return [];
  const { rows } = parseMdTable(compactGfmTables(section));
  const out: SceneVisualDictionaryRow[] = [];
  for (const r of rows) {
    const parsed = parseSceneDictionaryRowFromMd(r);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** 从大纲正文中提取「场景视觉辞典」段 */
export function extractSceneVisualDictionaryFromOutline(md: string): string {
  const body = extractMarkdownSectionByHeaderLevels(
    md,
    /场景视觉辞典|场景辞典|场景设定|场景表/,
    [2, 3, 1],
  );
  if (body) {
    const compact = compactGfmTables(body);
    if (parseMdTable(compact).rows.length) return compact;
  }
  return findSceneVisualDictionaryTableBlock(md);
}

/** 从大纲正文中提取「角色设定」段（表格或列表） */
export function extractCharacterSectionFromOutline(md: string): string {
  const body = extractMarkdownSectionByHeader(
    md,
    /角色设定|角色视觉辞典|人物表|角色设定卡|角色关系|主要角色|主要人物|角色/i,
  );
  if (!body) return "";
  const rows = parseCharacterListFromSection(body);
  if (rows.length) return formatCharacterTableMarkdown(rows);
  return body;
}

/** 去掉段内 JSON / 围栏，避免误落库到 storyboardMd */
function stripEmbeddedJsonFromMarkdownSection(text: string): string {
  let t = text.trim();
  if (!t) return t;
  t = t
    .replace(/```pro2-production-script[\s\S]*?```/gi, "")
    .replace(/```pro2-production-script[\s\S]*$/gi, "");
  const lines = t.split(/\r?\n/);
  const kept = lines.filter((line) => {
    const tr = line.trim();
    if (!tr) return true;
    if (tr.startsWith("|")) return true;
    if (/^#{1,6}\s/.test(tr)) return true;
    if (/^[\{\[]/.test(tr)) return false;
    if (/^"?(patch|schemaVersion|meta|visualStyle|shots|characters|props)"?\s*:/.test(tr)) {
      return false;
    }
    if (/^[\}\]],?$/.test(tr)) return false;
    return !/^"[^"]+"\s*:\s*[\{\[\"]/.test(tr);
  });
  return compactGfmTables(kept.join("\n").trim());
}

/** 从大纲正文中提取「分镜脚本」段（仅 GFM 表 · 不含 JSON 块） */
export function extractStoryboardSectionFromOutline(md: string): string {
  const body = extractMarkdownSectionByHeaderLevels(
    md,
    /分镜脚本|分镜表|镜头序列|分镜设计|镜头规划|镜头设计|storyboard/i,
    [2, 3, 1],
  );
  if (!body) return "";
  return stripEmbeddedJsonFromMarkdownSection(body);
}

export type Pro2HandoffRow = {
  index: number;
  item: string;
  owner: string;
  note: string;
};

/** 解析「下一步交接清单」GFM 表（4 列 canonical · 兼容 legacy 3 列） */
export function parseHandoffRows(md: string): Pro2HandoffRow[] {
  const section = extractHandoffSectionFromOutline(md);
  if (!section.trim()) return [];
  const { rows } = parseMdTable(compactGfmTables(section));
  const out: Pro2HandoffRow[] = [];
  for (const r of rows) {
    const indexRaw = pickColumn(r, ["序号", "index", "no", "#"]);
    const item =
      pickColumn(r, ["交接项", "环节", "item", "task"]) || "";
    const owner =
      pickColumn(r, ["负责方", "owner", "role", "team"]) || "";
    const note =
      pickColumn(r, [
        "备注",
        "说明",
        "建议工具/步骤",
        "note",
        "notes",
        "detail",
      ]) || "";
    if (!item.trim() && !note.trim()) continue;
    const parsedIdx = parseInt(String(indexRaw).replace(/\D/g, ""), 10);
    out.push({
      index: Number.isFinite(parsedIdx) && parsedIdx > 0 ? parsedIdx : out.length + 1,
      item: item.trim(),
      owner: owner.trim(),
      note: note.trim(),
    });
  }
  return out;
}

export function extractHandoffSectionFromOutline(md: string): string {
  return extractMarkdownSectionByHeaderLevels(
    md,
    /下一步交接清单|交接清单|handoff/i,
    [2, 3, 1],
  );
}

export function formatHandoffTableMarkdown(rows: Pro2HandoffRow[]): string {
  if (!rows.length) return "";
  const headerLines = STORY_PRO2_HANDOFF_TABLE_HEADER.split("\n");
  return [
    headerLines[0] ?? "",
    headerLines[1] ?? "",
    ...rows.map(
      (r) =>
        `| ${r.index} | ${escapeMdTableCell(r.item)} | ${escapeMdTableCell(r.owner)} | ${escapeMdTableCell(r.note)} |`,
    ),
  ].join("\n");
}

/** 主题模板分镜表 → 标准 hub 分镜 GFM 表 */
export function normalizeStoryboardSectionFromOutline(md: string): string {
  const section = extractStoryboardSectionFromOutline(md);
  if (!section) return "";
  const wrapped = /##\s*分镜脚本/i.test(section)
    ? section
    : `## 分镜脚本\n\n${section}`;
  return normalizeStoryboardSectionMd(wrapped);
}

/** 人读分镜段 · 提取并保留原表（对齐 docs/画布大模型代码解析.md · 不做 normalize 重排） */
export function extractPro2HumanStoryboardMd(gfm: string): string {
  const section = extractStoryboardSectionFromOutline(gfm);
  if (!section.trim()) return "";
  if (/##\s*分镜脚本/i.test(section)) return section.trim();
  return `## 分镜脚本\n\n${section.trim()}`;
}

/** 故事大纲里的「人物表（简要）」— 仅角色名与定位 */
export function parseOutlineBriefCharacters(md: string): Array<{
  name: string;
  role: string;
  appearance: string;
}> {
  const sectionMatch = md.match(
    /##\s*人物表[^\n]*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i,
  );
  const section = sectionMatch?.[1]?.trim() ?? "";
  if (section) return parseCharacterRows(section);
  const { headers, rows } = parseMdTable(md);
  const hasRole = headers.some((h) => {
    const nk = normHeader(h);
    return nk === "定位" || nk === "role";
  });
  const hasAppearance = headers.some((h) => {
    const nk = normHeader(h);
    return nk.includes("外观") || nk === "appearance" || nk === "visual";
  });
  if (hasRole && !hasAppearance && rows.length > 0) {
    return parseCharacterRows(
      [
        `| ${headers.join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.map((r) => `| ${headers.map((h) => r[h] ?? "").join(" | ")} |`),
      ].join("\n"),
    );
  }
  return [];
}

/** 大纲人物表与角色设定表角色名是否一致 */
export function outlineCharacterNamesAlign(
  outlineMd: string,
  characterMd: string,
): boolean {
  const brief = parseOutlineBriefCharacters(outlineMd).map((c) => c.name.trim());
  const chars = parseCharacterRows(characterMd).map((c) => c.name.trim());
  if (!brief.length) return true;
  if (!chars.length) return false;
  const setB = new Set(brief);
  const setC = new Set(chars);
  if (brief.length !== chars.length) return false;
  return brief.every((n) => setC.has(n)) && chars.every((n) => setB.has(n));
}

/** 从画面描述中回落提取「角色：台词」 */
function inferDialogueFromDescription(description: string): string {
  const hits: string[] = [];
  for (const raw of description.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([^：:\(（\n「]{1,24})[：:]\s*(.+)$/);
    if (m?.[1]?.trim() && m[2]?.trim()) {
      hits.push(`${m[1].trim()}：${m[2].trim()}`);
    }
    const quoted = line.match(/^[「『"]([^」』"]{1,40})[」』"]\s*[：:]?\s*(.+)$/);
    if (quoted?.[1] && quoted[2]?.trim()) {
      hits.push(`${quoted[1]}：${quoted[2].trim()}`);
    }
  }
  return hits.join("\n");
}

function normalizeDialogueCell(raw: string, description: string): string {
  const t = raw.trim();
  if (t && t !== "—" && t !== "-" && t !== "无" && t !== "无对白") return t;
  return inferDialogueFromDescription(description);
}

/** 专业版分镜表行（v2 导演表 + Pass2 提示词列） */
export type StoryboardTableRow = {
  frameIndex: number;
  /** 旧版简表「场景」列；专业版分镜表无此列 */
  scene: string;
  shotSize: string;
  /** v2 Pass1 */
  lighting: string;
  cameraMove: string;
  description: string;
  dialogue: string;
  duration: string;
  /** v2 Pass1 */
  sfxNote: string;
  /** v2 Pass1 · 道具列 */
  propNames: string;
  /** v2 Pass2 · 分镜图 */
  frameImagePrompt: string;
  /** v1 / 兼容 · AI生图提示词 */
  aiImagePrompt: string;
  aiVideoPrompt: string;
  lipSyncNote: string;
  /** 与 aiVideoPrompt 同步，供列同步 / 批量任务沿用 */
  videoPrompt: string;
};

export function isEmptyStoryboardCell(text: string | undefined): boolean {
  const t = (text ?? "").trim();
  return !t || t === "—" || t === "-" || t === "–" || t === "—";
}

function parseStoryboardAiVideoPrompt(
  r: Record<string, string>,
): string {
  const raw =
    pickColumn(r, [
      "ai视频提示词(英文)",
      "ai视频提示词",
      "ai video prompt",
      "视频提示",
      "videoprompt",
      "video prompt",
    ]) ||
    r["AI视频提示词(英文)"] ||
    r["视频提示"] ||
    "";
  return isEmptyStoryboardCell(raw) ? "" : raw;
}

const SHOT_SIZE_EN: Record<string, string> = {
  远景: "extreme wide shot",
  大全景: "extreme wide shot",
  全景: "wide shot",
  中远景: "medium wide shot",
  中景: "medium shot",
  中近景: "medium close-up",
  近景: "close-up",
  特写: "extreme close-up",
  大特写: "extreme close-up",
  双人近景: "two-shot close-up",
  过肩: "over-the-shoulder shot",
};

function shotSizeToEnglish(shotSize: string): string {
  const t = shotSize.trim();
  if (!t || isEmptyStoryboardCell(t)) return "";
  return SHOT_SIZE_EN[t] ?? `${t} shot`;
}

/** LLM 未填 AI 视频提示词时，从画面描述等列合成英文兜底（供展示 / 生视频） */
export function buildFallbackAiVideoPrompt(row: {
  frameIndex: number;
  shotSize?: string;
  cameraMove?: string;
  description?: string;
  dialogue?: string;
}): string {
  const desc = row.description?.trim();
  if (!desc) return "";
  const parts = ["Cinematic film still"];
  const shot = shotSizeToEnglish(row.shotSize ?? "");
  if (shot) parts.push(shot);
  const move = row.cameraMove?.trim();
  if (move && !isEmptyStoryboardCell(move)) {
    parts.push(`${move} camera movement`);
  }
  parts.push(desc);
  const dialogue = row.dialogue?.trim();
  if (dialogue && !isEmptyStoryboardCell(dialogue)) {
    parts.push("with on-screen dialogue");
  }
  return parts.join(", ");
}

export function enrichStoryboardRowsAiVideoPrompts(
  rows: StoryboardTableRow[],
): StoryboardTableRow[] {
  return rows.map((row) => {
    if (!isEmptyStoryboardCell(row.aiVideoPrompt)) return row;
    const fallback = buildFallbackAiVideoPrompt(row);
    if (!fallback) return row;
    return {
      ...row,
      aiVideoPrompt: fallback,
      videoPrompt: fallback,
    };
  });
}

/** 空 AI 生图列时从画面描述 + 景别合成中文兜底 */
export function enrichStoryboardRowsAiImagePrompts(
  rows: StoryboardTableRow[],
): StoryboardTableRow[] {
  return rows.map((row) => {
    if (!isEmptyStoryboardCell(row.aiImagePrompt)) return row;
    const desc = row.description?.trim();
    if (!desc) return row;
    const shot = (row.shotSize ?? "").trim();
    const fallback = [
      "电影级分镜静帧",
      shot && !isEmptyStoryboardCell(shot) ? shot : "",
      desc,
    ]
      .filter(Boolean)
      .join("，");
    return { ...row, aiImagePrompt: fallback };
  });
}

export function enrichStoryboardRowsForPack(rows: StoryboardTableRow[]): StoryboardTableRow[] {
  return enrichStoryboardRowsAiImagePrompts(enrichStoryboardRowsAiVideoPrompts(rows));
}

/** 分镜表解析源：优先 ## 分镜脚本 段，避免误读段首「镜数规划」等小表 */
export function resolveStoryboardMarkdownForParse(md: string): string {
  const raw = (md ?? "").trim();
  if (!raw) return raw;
  const section = extractStoryboardSectionFromOutline(raw);
  return section || raw;
}

/** 补全空 AI 视频提示词并规范为 9 列 GFM 表 */
export function storyboardMdHasParseableRows(md: string): boolean {
  return parseStoryboardRows(md).length > 0;
}

export function normalizeStoryboardSectionMd(md: string): string {
  const raw = md.trim();
  if (!raw) return raw;
  const rows = parseStoryboardRows(raw);
  if (!rows.length) return "";
  const enriched = enrichStoryboardRowsForPack(rows);
  const table = formatStoryboardTableMarkdown(enriched);
  if (/##\s*分镜脚本/i.test(raw)) {
    return raw.replace(/##\s*分镜脚本[\s\S]*/i, `## 分镜脚本\n\n${table}`);
  }
  return `## 分镜脚本\n\n${table}`;
}

export function ensureStoryboardAiVideoPromptsMd(md: string): string {
  const raw = (md ?? "").trim();
  if (!raw) return raw;
  const rows = parseStoryboardRows(raw);
  if (!rows.length) return raw;
  if (!rows.some((r) => isEmptyStoryboardCell(r.aiVideoPrompt))) return raw;
  return normalizeStoryboardSectionMd(raw);
}

function parseStoryboardAiImagePrompt(r: Record<string, string>): string {
  const raw = pickColumn(r, [
    "ai生图提示词(英文)",
    "ai生图提示词",
    "ai image prompt",
    "image prompt",
  ]);
  return isEmptyStoryboardCell(raw) ? "" : raw;
}

/** 分镜表 → 按镜号排序的行 */
export function parseStoryboardRows(md: string): StoryboardTableRow[] {
  const { rows } = parseMdTable(resolveStoryboardMarkdownForParse(md));
  return rows
    .map((r, i) => {
      const rawIdx =
        pickColumn(r, [
          "镜号",
          "镜头编号",
          "编号",
          "index",
          "frame",
          "shot",
        ]) ||
        r["镜号"] ||
        r["镜头编号"] ||
        r["index"] ||
        "";
      const parsedIdx = parseInt(String(rawIdx).replace(/\D/g, ""), 10);
      const frameIndex = Number.isFinite(parsedIdx) && parsedIdx > 0 ? parsedIdx : i + 1;
      const shotSize = pickColumn(r, ["景别", "shot size", "framing"]);
      const cameraMove = pickColumn(r, [
        "运镜",
        "camera",
        "camera move",
        "镜头运动",
      ]);
      const scene =
        pickColumn(r, ["场景", "scene", "location"]) || r["场景"] || "";
      const duration = pickColumn(r, [
        "时长(秒)",
        "时长（秒）",
        "时长",
        "duration",
      ]);
      const aiImagePrompt = parseStoryboardAiImagePrompt(r);
      const description =
        pickColumn(r, ["画面描述", "description", "visual", "画面"]) ||
        r["画面描述"] ||
        "";
      const dialogueRaw =
        pickColumn(r, [
          "台词",
          "对白",
          "对白/音效",
          "dialogue",
          "scenetext",
          "scene text",
          "旁白",
        ]) ||
        r["台词"] ||
        r["对白/音效"] ||
        "";
      const aiVideoPrompt = parseStoryboardAiVideoPrompt(r);
      const lipSyncNote = pickColumn(r, [
        "口型/配音备注",
        "口型",
        "配音",
        "lip sync",
        "lipsync",
      ]);
      const lighting = pickColumn(r, ["光影", "lighting", "光线", "光影氛围"]);
      const sfxNote = pickColumn(r, ["音效", "sfx", "sound"]);
      const propNamesRaw = pickColumn(r, ["道具", "props", "prop"]);
      const propNames = stripPro2AnchorPlaceholders(propNamesRaw) || propNamesRaw.trim();
      const frameImagePrompt =
        pickColumn(r, [
          "分镜图提示词",
          "frame image prompt",
          "frameimageprompt",
        ]) || aiImagePrompt;
      return {
        frameIndex,
        scene: stripPro2AnchorPlaceholders(scene),
        shotSize,
        lighting,
        cameraMove,
        description,
        dialogue: normalizeDialogueCell(dialogueRaw, description),
        duration,
        sfxNote,
        propNames,
        frameImagePrompt,
        aiImagePrompt: frameImagePrompt || aiImagePrompt,
        aiVideoPrompt,
        lipSyncNote,
        videoPrompt: aiVideoPrompt,
      };
    })
    .sort((a, b) => a.frameIndex - b.frameIndex);
}

export function isProStoryboardTableMd(md: string): boolean {
  const t = md.trim();
  if (!t) return true;
  const header = t
    .split(/\r?\n/)
    .find(
      (l) =>
        l.trim().startsWith("|") &&
        l.trim().endsWith("|") &&
        !/^[\|\s\-:]+$/.test(l.trim()),
    );
  if (!header) return false;
  const nk = normHeader(header);
  return (
    nk.includes("运镜") ||
    nk.includes("光影") ||
    nk.includes("aivideoprompt") ||
    nk.includes("口型") ||
    nk.includes("时长")
  );
}

/** v2 导演表（含光影/道具/音效 · 无 AI 提示词列） */
export function isV2StoryboardTableMd(md: string): boolean {
  const t = md.trim();
  if (!t) return true;
  const header = t
    .split(/\r?\n/)
    .find(
      (l) =>
        l.trim().startsWith("|") &&
        l.trim().endsWith("|") &&
        !/^[\|\s\-:]+$/.test(l.trim()),
    );
  if (!header) return true;
  const nk = normHeader(header);
  return nk.includes("光影") && !nk.includes("ai生图");
}

/** 更新分镜表中某一镜的对白列，写回 GFM 表 Markdown */
export function patchStoryboardDialogue(
  md: string,
  frameIndex: number,
  dialogue: string,
): string {
  const lines = md.split(/\r?\n/);
  const headerIdx = lines.findIndex(
    (l) =>
      l.trim().startsWith("|") &&
      l.trim().endsWith("|") &&
      !/^[\|\s\-:]+$/.test(l.trim()),
  );
  if (headerIdx < 0) return md;

  const headers = lines[headerIdx]
    .trim()
    .slice(1, -1)
    .split("|")
    .map((h) => h.trim());

  const idxCol = headers.findIndex((h) => {
    const nk = normHeader(h);
    return nk === "镜号" || nk === "index" || nk === "frame" || nk === "shot";
  });
  const dialogueCol = headers.findIndex((h) => {
    const nk = normHeader(h);
    return (
      nk === "台词" ||
      nk === "对白" ||
      nk === "dialogue" ||
      nk.includes("scenetext") ||
      nk === "旁白"
    );
  });
  if (dialogueCol < 0) return md;

  for (let i = headerIdx + 2; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim().startsWith("|")) break;
    if (/^[\|\s\-:]+$/.test(raw.trim())) continue;
    const cells = raw
      .trim()
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
    const rawIdx =
      idxCol >= 0 ? cells[idxCol] : cells[0] ?? String(i - headerIdx);
    const fi = parseInt(String(rawIdx), 10) || i - headerIdx;
    if (fi !== frameIndex) continue;
    while (cells.length < headers.length) cells.push("");
    cells[dialogueCol] = dialogue;
    lines[i] = `| ${cells.join(" | ")} |`;
    return lines.join("\n");
  }
  return md;
}

export function formatStoryboardTableMarkdown(
  rows: Array<{
    frameIndex: number;
    scene?: string;
    shotSize?: string;
    lighting?: string;
    cameraMove?: string;
    description: string;
    dialogue: string;
    duration?: string;
    propNames?: string;
    sfxNote?: string;
    aiImagePrompt?: string;
    aiVideoPrompt?: string;
    lipSyncNote?: string;
    videoPrompt?: string;
  }>,
  options?: { format?: "pro" | "pro-v1" | "legacy" },
): string {
  if (!rows.length) return "";
  const useLegacy = options?.format === "legacy";
  const useV1 = options?.format === "pro-v1";
  if (!useLegacy && !useV1) {
    const headerLines = STORY_PRO2_STORYBOARD_TABLE_HEADER.split("\n");
    return [
      headerLines[0] ?? "",
      headerLines[1] ?? "",
      ...rows.map((r) => {
        return `| ${r.frameIndex} | ${escapeMdTableCell(r.shotSize ?? "")} | ${escapeMdTableCell(r.lighting ?? "")} | ${escapeMdTableCell(r.cameraMove ?? "")} | ${escapeMdTableCell(r.description)} | ${escapeMdTableCell(r.propNames ?? "—")} | ${escapeMdTableCell(r.dialogue)} | ${escapeMdTableCell(r.duration ?? "")} | ${escapeMdTableCell(r.sfxNote ?? "")} | ${escapeMdTableCell(r.lipSyncNote ?? "")} |`;
      }),
    ].join("\n");
  }
  if (useV1) {
    const headerLines = STORY_PRO2_STORYBOARD_TABLE_HEADER_V1.split("\n");
    return [
      headerLines[0] ?? "",
      headerLines[1] ?? "",
      ...rows.map((r) => {
        const aiImage = r.aiImagePrompt?.trim() ?? "";
        const aiVideo =
          r.aiVideoPrompt?.trim() || r.videoPrompt?.trim() || "";
        return `| ${r.frameIndex} | ${escapeMdTableCell(r.shotSize ?? "")} | ${escapeMdTableCell(r.cameraMove ?? "")} | ${escapeMdTableCell(r.description)} | ${escapeMdTableCell(r.dialogue)} | ${escapeMdTableCell(r.duration ?? "")} | ${escapeMdTableCell(aiImage)} | ${escapeMdTableCell(aiVideo)} | ${escapeMdTableCell(r.lipSyncNote ?? "")} |`;
      }),
    ].join("\n");
  }
  return [
    "| 镜号 | 场景 | 画面描述 | 台词 | 视频提示 |",
    "|------|------|----------|------|----------|",
    ...rows.map((r) => {
      const vp = r.videoPrompt?.trim() || r.aiVideoPrompt?.trim() || "";
      return `| ${r.frameIndex} | ${escapeMdTableCell(r.scene ?? "")} | ${escapeMdTableCell(r.description)} | ${escapeMdTableCell(r.dialogue)} | ${escapeMdTableCell(vp)} |`;
    }),
  ].join("\n");
}
