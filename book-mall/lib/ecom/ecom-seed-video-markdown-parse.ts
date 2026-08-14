import type {
  SeedVideoDirectPlan,
  SeedVideoScript,
  SeedVideoScriptRow,
  SeedVideoShot,
} from "@/lib/ecom/ecom-seed-video-types";

function normalizeHeader(cell: string): string {
  return cell.replace(/\s+/g, "").toLowerCase();
}

function colIndex(headers: string[], aliases: string[]): number {
  const norm = headers.map(normalizeHeader);
  for (const a of aliases) {
    const i = norm.findIndex((h) => h.includes(normalizeHeader(a)));
    if (i >= 0) return i;
  }
  return -1;
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return [];
  return trimmed
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((c) => /^:?-+:?$/.test(c.replace(/\s/g, "")));
}

function parseDurationSec(raw: string | undefined): number {
  if (!raw) return 4;
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  if (!m) return 4;
  const n = parseFloat(m[1]!);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 4;
}

function parseScriptIdFromTitle(title: string): SeedVideoScript["id"] | null {
  if (/脚本一|方案一|方案\s*1|Plan\s*1/i.test(title)) return "script-1";
  if (/脚本二|方案二|方案\s*2|Plan\s*2/i.test(title)) return "script-2";
  if (/脚本三|方案三|方案\s*3|Plan\s*3/i.test(title)) return "script-3";
  return null;
}

export function parseSeedVideoScriptsFromMarkdown(
  markdown: string,
): SeedVideoScript[] {
  const scripts: SeedVideoScript[] = [];
  const blocks = markdown.split(/(?=(?:^|\n)\s*(?:#+\s*)?(?:脚本|方案)\s*[一二三123])/gi);

  for (const block of blocks) {
    const titleLine = block.match(/(?:脚本|方案)\s*([一二三123])[^\n]*/i);
    const id = titleLine
      ? parseScriptIdFromTitle(titleLine[0]!)
      : parseScriptIdFromTitle(block.slice(0, 80));
    if (!id) continue;

    const lines = block.split("\n");
    let headers: string[] | null = null;
    const rows: SeedVideoScriptRow[] = [];
    let beat = 0;

    for (const line of lines) {
      const cells = parseTableRow(line);
      if (cells.length < 3) continue;
      if (!headers) {
        if (isSeparatorRow(cells)) continue;
        const joined = cells.join("");
        if (!joined.includes("分镜") && !joined.includes("口播") && !joined.includes("画面")) {
          continue;
        }
        headers = cells;
        continue;
      }
      if (isSeparatorRow(cells)) continue;

      const beatCol = colIndex(headers, ["分镜", "镜号"]);
      const durCol = colIndex(headers, ["时长", "时间"]);
      const matCol = colIndex(headers, ["画面素材", "素材", "画面"]);
      const voCol = colIndex(headers, ["口播文案", "口播", "台词"]);

      beat += 1;
      const beatIndex = beatCol >= 0 ? parseInt(cells[beatCol]?.replace(/\D/g, "") || "", 10) : beat;
      rows.push({
        beatIndex: Number.isFinite(beatIndex) && beatIndex > 0 ? beatIndex : beat,
        durationSec: parseDurationSec(durCol >= 0 ? cells[durCol] : undefined),
        refImageLabel: (matCol >= 0 ? cells[matCol] : cells[2] ?? "").trim() || `图${beat}`,
        voiceover: (voCol >= 0 ? cells[voCol] : cells[cells.length - 1] ?? "").trim(),
      });
    }

    if (rows.length === 0) continue;

    const titleMatch = block.match(/[：:]\s*([^\n|]+)/);
    const title = titleMatch?.[1]?.trim() || `脚本${id.replace("script-", "")}`;

    scripts.push({
      id,
      title,
      angle: title,
      targetPlatforms: [],
      totalDurationSec: rows.reduce((s, r) => s + r.durationSec, 0),
      rows,
    });
  }

  return scripts;
}

export function parseSeedVideoShotsFromMarkdown(markdown: string): SeedVideoShot[] {
  const lines = markdown.split("\n");
  let headers: string[] | null = null;
  const shots: SeedVideoShot[] = [];

  for (const line of lines) {
    const cells = parseTableRow(line);
    if (cells.length < 4) continue;
    if (!headers) {
      if (isSeparatorRow(cells)) continue;
      const joined = cells.join("");
      if (!joined.includes("镜号") && !joined.includes("提示词")) continue;
      headers = cells;
      continue;
    }
    if (isSeparatorRow(cells)) continue;

    const idxCol = colIndex(headers, ["镜号", "镜头"]);
    const timeCol = colIndex(headers, ["时间切片", "时间"]);
    const refCol = colIndex(headers, ["参考素材图", "参考图", "素材"]);
    const descCol = colIndex(headers, ["镜头描述", "描述", "画面"]);
    const promptCol = colIndex(headers, ["AI视频生成提示词", "视频提示词", "提示词"]);
    const voCol = colIndex(headers, ["口播文案", "口播", "台词"]);

    const index = parseInt((idxCol >= 0 ? cells[idxCol] : cells[0])?.replace(/\D/g, "") || "", 10);
    if (!Number.isFinite(index) || index <= 0) continue;

    const timeSlice = (timeCol >= 0 ? cells[timeCol] : "").trim() || `${index}`;
    const refImageLabel = (refCol >= 0 ? cells[refCol] : "").trim() || `图${index}`;
    const durationSec = parseDurationSec(timeSlice);

    shots.push({
      index,
      timeSlice,
      refImageId: "",
      refImageLabel,
      sceneDescription: (descCol >= 0 ? cells[descCol] : "").trim(),
      videoPrompt: (promptCol >= 0 ? cells[promptCol] : cells[cells.length - 2] ?? "").trim(),
      voiceover: (voCol >= 0 ? cells[voCol] : cells[cells.length - 1] ?? "").trim(),
      durationSec,
    });
  }

  return shots.sort((a, b) => a.index - b.index);
}

export function parseSeedVideoDirectFromMarkdown(markdown: string): SeedVideoDirectPlan | null {
  const promptMatch = markdown.match(/(?:全局|AI)?视频提示词[：:]\s*([\s\S]+?)(?:\n#{1,3}|\n完整口播|\n画幅|$)/i);
  const voMatch = markdown.match(/(?:完整|连贯)?口播文案[：:]\s*([\s\S]+?)(?:\n#{1,3}|\n画幅|\nBGM|$)/i);
  const globalPrompt = promptMatch?.[1]?.trim() ?? "";
  const fullVoiceover = voMatch?.[1]?.trim() ?? "";
  if (!globalPrompt && !fullVoiceover) return null;
  return {
    globalPrompt: globalPrompt || fullVoiceover,
    fullVoiceover,
    aspectRatio: "9:16",
    durationSec: 30,
    bgmPreset: "",
  };
}

export function bindShotRefIds(
  shots: SeedVideoShot[],
  refLabelToId: Map<string, string>,
): SeedVideoShot[] {
  return shots.map((s) => {
    const label = s.refImageLabel.trim();
    const numMatch = label.match(/图\s*(\d+)/);
    const key = numMatch ? `图${numMatch[1]}` : label;
    const refImageId = refLabelToId.get(key) ?? refLabelToId.get(label) ?? "";
    return { ...s, refImageId };
  });
}

export function buildRefLabelToIdMap(
  references: Array<{ id: string; label: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  references.forEach((r, i) => {
    map.set(`图${i + 1}`, r.id);
    map.set(`图片${i + 1}`, r.id);
    map.set(r.label, r.id);
  });
  return map;
}
