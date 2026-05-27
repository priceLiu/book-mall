/** 解析 GFM 表格为行对象（首行作表头）。 */

export type MdTableRow = Record<string, string>;

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function pickColumn(row: MdTableRow, aliases: string[]): string {
  for (const alias of aliases) {
    for (const [key, val] of Object.entries(row)) {
      const nk = normHeader(key);
      if (nk === alias || nk.includes(alias)) {
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

function parseGfmTableRowCells(line: string): string[] | null {
  const t = normalizeMdTableLine(line);
  if (!t.startsWith("|")) return null;
  const inner = t.replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((c) => c.trim());
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

function parseMdTableLines(normalized: string): { headers: string[]; rows: MdTableRow[] } {
  const lines = normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex(
    (l) => l.startsWith("|") && !/^[\|\s\-:]+$/.test(l),
  );
  if (headerIdx < 0) return { headers: [], rows: [] };

  const headerCells = parseGfmTableRowCells(lines[headerIdx]!);
  if (!headerCells?.length) return { headers: [], rows: [] };
  const headers = headerCells;

  const rows: MdTableRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.startsWith("|")) break;
    if (/^[\|\s\-:]+$/.test(line)) continue;
    const cells = parseGfmTableRowCells(line);
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
  return parseMdTableLines(prepareMarkdownForPreview(md));
}

/** 从段落正文解析角色（GFM 表 · 列表 · 「角色名 · …」行） */
export function parseCharacterListFromSection(body: string): Array<{
  name: string;
  role: string;
  appearance: string;
}> {
  const fromTable = parseCharacterRows(body);
  if (fromTable.length) return fromTable;

  const out: Array<{ name: string; role: string; appearance: string }> = [];
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
      return { name, role, appearance, personality };
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
  }>,
): string {
  if (!rows.length) return "";
  return [
    "| 姓名 | 身份 | 外貌关键词 | 性格 |",
    "|------|------|------------|------|",
    ...rows.map(
      (r) =>
        `| ${escapeMdTableCell(r.name)} | ${escapeMdTableCell(r.role)} | ${escapeMdTableCell(r.appearance)} | ${escapeMdTableCell(r.personality ?? "")} |`,
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

/** 预览用：合并换行 / 紧凑表格 / 标题与表格间补空行（不转义，交给 remark-gfm 渲染） */
export function prepareMarkdownForPreview(md: string): string {
  let s = md.replace(/\uFF5C/g, "|").trim();
  s = unescapeOverEscapedMarkdown(s);
  s = splitHeadingEmbeddedTableHeaders(s);
  s = joinMultilineGfmTableRows(s);
  s = compactGfmTables(s);
  if (!s) return "";
  s = s.replace(/<br\s*\/?>/gi, "  \n");
  s = ensureMarkdownBlockSpacing(s);
  s = s.replace(/(^|\n)(#{1,6}[^\n]+)\n(?!\n)(\|)/gm, "$1$2\n\n$3");
  return s.replace(/\n{3,}/g, "\n\n").trim();
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

/** 解析 GFM 表格行对象用（含转义修复，勿用于 Markdown 预览） */
export function prepareMarkdownForTableParse(md: string): string {
  return repairGfmTablesForPreview(prepareMarkdownForPreview(md));
}

function extractMarkdownSectionByHeader(
  md: string,
  titlePattern: RegExp,
): string {
  const re = /^##\s+(.+)$/gm;
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
  if (idx < 0) return "";
  const bodyStart = hits[idx].end;
  const bodyEnd = idx + 1 < hits.length ? hits[idx + 1].start : md.length;
  return md.slice(bodyStart, bodyEnd).trim();
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

/** 从大纲正文中提取「分镜脚本」段 */
export function extractStoryboardSectionFromOutline(md: string): string {
  const body = extractMarkdownSectionByHeader(md, /分镜脚本|分镜表|镜头序列/);
  if (!body) return "";
  return compactGfmTables(body);
}

/** 主题模板分镜表 → 标准 hub 分镜 GFM 表 */
export function normalizeStoryboardSectionFromOutline(md: string): string {
  const section = extractStoryboardSectionFromOutline(md);
  if (!section) return "";
  const rows = parseStoryboardRows(section);
  if (!rows.length) return section;
  return formatStoryboardTableMarkdown(rows);
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

/** 分镜表 → 按镜号排序的行 */
export function parseStoryboardRows(md: string): Array<{
  frameIndex: number;
  scene: string;
  description: string;
  dialogue: string;
  videoPrompt: string;
}> {
  const { rows } = parseMdTable(md);
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
        String(i + 1);
      const frameIndex = parseInt(String(rawIdx), 10) || i + 1;
      const shotSize = pickColumn(r, ["景别", "shot size", "framing"]);
      const scene =
        pickColumn(r, ["场景", "scene", "location"]) ||
        r["场景"] ||
        shotSize ||
        "";
      const duration = pickColumn(r, ["时长", "duration", "时长(秒)"]);
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
          "音效",
        ]) ||
        r["台词"] ||
        r["对白/音效"] ||
        "";
      return {
        frameIndex,
        scene,
        description,
        dialogue: normalizeDialogueCell(dialogueRaw, description),
        videoPrompt:
          pickColumn(r, [
            "视频提示",
            "videoprompt",
            "video prompt",
            "运镜",
            "ai视频提示词",
            "ai视频提示词(英文)",
          ]) ||
          r["视频提示"] ||
          r["AI视频提示词(英文)"] ||
          (duration ? `时长 ${duration} 秒` : ""),
      };
    })
    .sort((a, b) => a.frameIndex - b.frameIndex);
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
    scene: string;
    description: string;
    dialogue: string;
    videoPrompt: string;
  }>,
): string {
  if (!rows.length) return "";
  return [
    "| 镜号 | 场景 | 画面描述 | 台词 | 视频提示 |",
    "|------|------|----------|------|----------|",
    ...rows.map(
      (r) =>
        `| ${r.frameIndex} | ${escapeMdTableCell(r.scene)} | ${escapeMdTableCell(r.description)} | ${escapeMdTableCell(r.dialogue)} | ${escapeMdTableCell(r.videoPrompt)} |`,
    ),
  ].join("\n");
}
