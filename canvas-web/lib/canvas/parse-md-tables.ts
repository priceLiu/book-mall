/** 解析 GFM 表格为行对象（首行作表头）。 */

export type MdTableRow = Record<string, string>;

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function pickColumn(row: MdTableRow, aliases: string[]): string {
  for (const [key, val] of Object.entries(row)) {
    const nk = normHeader(key);
    if (aliases.some((a) => nk === a || nk.includes(a))) return val;
  }
  return "";
}

export function parseMdTable(md: string): { headers: string[]; rows: MdTableRow[] } {
  const lines = md.split(/\r?\n/).map((l) => l.trim());
  const headerIdx = lines.findIndex(
    (l) => l.startsWith("|") && l.endsWith("|") && !/^[\|\s\-:]+$/.test(l),
  );
  if (headerIdx < 0) return { headers: [], rows: [] };

  const headerLine = lines[headerIdx];
  const headers = headerLine
    .slice(1, -1)
    .split("|")
    .map((h) => h.trim());

  const rows: MdTableRow[] = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (!line.startsWith("|")) break;
    if (/^[\|\s\-:]+$/.test(line)) continue;
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
    const row: MdTableRow = {};
    headers.forEach((h, j) => {
      row[h] = cells[j] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
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
}> {
  const { rows } = parseMdTable(md);
  return rows
    .map((r) => ({
      name: pickColumn(r, [
        "角色",
        "name",
        "character",
        "角色名",
        "character name",
      ]),
      role: pickColumn(r, [
        "定位",
        "role",
        "角色定位",
        "身份",
        "身份说明",
        "剧情背景",
        "背景",
        "description",
      ]),
      appearance: pickColumn(r, [
        "外观描述",
        "appearance",
        "描述",
        "appearance description",
        "外观",
        "visual",
      ]),
    }))
    .map((c) => ({
      ...c,
      appearance:
        c.appearance.trim() ||
        (c.role.trim() ? `（待补充外观）${c.role}` : "（待补充外观）"),
    }))
    .filter((c) => c.name.trim());
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

export function formatCharacterTableMarkdown(
  rows: Array<{ name: string; role: string; appearance: string }>,
): string {
  if (!rows.length) return "";
  return [
    "| 角色 | 定位 | 外观描述 |",
    "|------|------|----------|",
    ...rows.map(
      (r) => `| ${r.name} | ${r.role} | ${r.appearance} |`,
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
  const merged: Array<{ name: string; role: string; appearance: string }> = [];
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
    merged.push({ name: b.name, role, appearance });
  }
  for (const e of existing) {
    if (!seen.has(e.name)) {
      merged.push({ ...e, role: preferDetailedRole(e.role, "") });
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
    const t = line.trim();
    const isPipe = t.startsWith("|");
    const isSep = isPipe && /^[\|\s\-:]+$/.test(t);
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

/** 大纲展示：去掉嵌入的「制作包」段落（角色 / 关系 / 分镜 / 核心对白） */
export function stripOutlineEmbeddedPackSections(md: string): string {
  let s = stripOutlineCharacterTable(md);
  s = s.replace(/\n##\s*[二三四五]、[\s\S]*?(?=\n##\s|$)/g, "").trim();
  s = s.replace(
    /\n##\s*(?:角色设定|角色设定卡|角色关系|分镜脚本|核心对白)[^\n]*\n[\s\S]*?(?=\n##\s|$)/gi,
    "",
  ).trim();
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/** 从大纲正文中提取「角色设定」段（表格或列表） */
export function extractCharacterSectionFromOutline(md: string): string {
  const body = extractMarkdownSectionByHeader(
    md,
    /角色设定|人物表|角色设定卡|角色关系|角色/i,
  );
  if (!body) return "";
  const rows = parseCharacterListFromSection(body);
  if (rows.length) return formatCharacterTableMarkdown(rows);
  return body;
}

/** 从大纲正文中提取「分镜脚本」段 */
export function extractStoryboardSectionFromOutline(md: string): string {
  const body = extractMarkdownSectionByHeader(md, /分镜脚本|分镜表/);
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
      return {
        frameIndex,
        scene,
        description:
          pickColumn(r, ["画面描述", "description", "visual", "画面"]) ||
          r["画面描述"] ||
          "",
        dialogue:
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
          "",
        videoPrompt:
          pickColumn(r, ["视频提示", "videoprompt", "video prompt", "运镜"]) ||
          r["视频提示"] ||
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

function escapeMdTableCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
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
