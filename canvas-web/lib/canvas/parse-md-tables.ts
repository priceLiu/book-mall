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
      role: pickColumn(r, ["定位", "role", "角色定位"]),
      appearance: pickColumn(r, [
        "外观描述",
        "appearance",
        "描述",
        "appearance description",
        "外观",
        "visual",
      ]),
    }))
    .filter((c) => c.name.trim() && c.appearance.trim());
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
