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
        pickColumn(r, ["镜号", "index", "frame", "shot"]) ||
        r["镜号"] ||
        r["index"] ||
        String(i + 1);
      const frameIndex = parseInt(String(rawIdx), 10) || i + 1;
      return {
        frameIndex,
        scene: pickColumn(r, ["场景", "scene", "location"]) || r["场景"] || "",
        description:
          pickColumn(r, ["画面描述", "description", "visual", "画面"]) ||
          r["画面描述"] ||
          "",
        dialogue:
          pickColumn(r, [
            "台词",
            "对白",
            "dialogue",
            "scenetext",
            "scene text",
            "旁白",
          ]) ||
          r["台词"] ||
          "",
        videoPrompt:
          pickColumn(r, ["视频提示", "videoprompt", "video prompt", "运镜"]) ||
          r["视频提示"] ||
          "",
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
