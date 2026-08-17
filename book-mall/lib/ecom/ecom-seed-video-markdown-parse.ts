import {
  ECOM_SEED_VIDEO_DEFAULT_TARGET_DURATION_SEC,
  type SeedVideoDirectPlan,
  type SeedVideoScript,
  type SeedVideoScriptRow,
  type SeedVideoShot,
} from "@/lib/ecom/ecom-seed-video-types";
import {
  directPlanFromStructuredPatch,
  extractSeedVideoStructuredPatch,
  scriptsFromStructuredPatch,
  shotsFromStructuredPatch,
} from "@/lib/ecom/ecom-seed-video-structured";

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
  const range = raw.match(/(\d+(?:\.\d+)?)\s*[-~–—]\s*(\d+(?:\.\d+)?)\s*s?/i);
  if (range) {
    const start = parseFloat(range[1]!);
    const end = parseFloat(range[2]!);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return Math.round(end - start);
    }
  }
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  if (!m) return 4;
  const n = parseFloat(m[1]!);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 4;
}

const CIRCLED_INDEX_MAP: Record<string, number> = {
  "①": 1,
  "②": 2,
  "③": 3,
  "④": 4,
  "⑤": 5,
  "⑥": 6,
  "⑦": 7,
  "⑧": 8,
  "⑨": 9,
};

function parseShotRowIndex(raw: string | undefined): number {
  const t = (raw ?? "").trim();
  if (!t) return NaN;
  if (CIRCLED_INDEX_MAP[t] != null) return CIRCLED_INDEX_MAP[t]!;
  for (const [marker, value] of Object.entries(CIRCLED_INDEX_MAP)) {
    if (t.startsWith(marker)) return value;
  }
  const digit = t.match(/(\d+)/);
  if (digit) return parseInt(digit[1]!, 10);
  return NaN;
}

function parseScriptIdFromTitle(title: string): SeedVideoScript["id"] | null {
  if (/脚本一|方案一|Plan\s*1/i.test(title)) return "script-1";
  if (/脚本二|方案二|Plan\s*2/i.test(title)) return "script-2";
  if (/脚本三|方案三|Plan\s*3/i.test(title)) return "script-3";
  return null;
}

const SCRIPT_BLOCK_HEADER_RE =
  /(?:^|\n)\s*(?:#+\s*)?(?:\*\*)?脚本\s*([一二三123])(?:\*\*)?(?:[：:－\-—·][^\n|]+)?[^\n]*/gi;

function splitScriptBlocks(markdown: string): string[] {
  const headers: number[] = [];
  for (const m of markdown.matchAll(SCRIPT_BLOCK_HEADER_RE)) {
    if (m.index != null) headers.push(m.index);
  }
  if (headers.length === 0) return [];
  const blocks: string[] = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i]!;
    const end = i + 1 < headers.length ? headers[i + 1]! : markdown.length;
    blocks.push(markdown.slice(start, end));
  }
  return blocks;
}

export function parseSeedVideoScriptsFromMarkdown(
  markdown: string,
): SeedVideoScript[] {
  const patch = extractSeedVideoStructuredPatch(markdown);
  if (patch?.scripts?.length === 3) {
    return scriptsFromStructuredPatch(patch);
  }
  return [];
}

export function parseSeedVideoShotsFromMarkdown(markdown: string): SeedVideoShot[] {
  const patch = extractSeedVideoStructuredPatch(markdown);
  if (patch?.shots?.length) {
    const fromStructured = shotsFromStructuredPatch(patch);
    if (fromStructured.length >= 2) return fromStructured;
  }

  const unified = parseUnifiedShotSequenceTable(markdown, { requireAiPrompt: false });
  if (unified.length >= 2) {
    return unified.map((s) => ({
      index: s.index,
      timeSlice: s.timeSlice,
      refImageId: "",
      refImageLabel: s.refImageLabel,
      sceneDescription: s.sceneDescription,
      videoPrompt: s.videoPrompt,
      voiceover: s.voiceover,
      durationSec: s.durationSec,
    }));
  }

  const lines = markdown.split("\n");
  let headers: string[] | null = null;
  const shots: SeedVideoShot[] = [];

  for (const line of lines) {
    const cells = parseTableRow(line);
    if (cells.length < 4) continue;
    if (!headers) {
      if (isSeparatorRow(cells)) continue;
      const joined = cells.join("");
      if (
        !joined.includes("镜号") &&
        !joined.includes("序号") &&
        !joined.includes("提示词") &&
        !joined.includes("素材映射")
      ) {
        continue;
      }
      headers = cells;
      continue;
    }
    if (isSeparatorRow(cells)) continue;

    const idxCol = colIndex(headers, ["镜号", "镜头", "序号"]);
    const timeCol = colIndex(headers, ["时间切片", "时间", "时长"]);
    const refCol = colIndex(headers, ["参考素材", "参考素材图", "参考图", "素材", "素材映射"]);
    const camCol = colIndex(headers, ["运镜", "运镜方式", "运镜参数"]);
    const mergedCol = colIndex(headers, ["画面描述与运镜", "画面描述及运镜", "画面与运镜"]);
    const descCol = colIndex(headers, [
      "画面设计",
      "画面描述",
      "画面细节描述",
      "画面细节渲染",
      "镜头描述",
      "描述",
      "画面",
    ]);
    const promptCol = colIndex(headers, [
      "AI视频生成提示词",
      "AI 视频生成提示词",
      "视频提示词",
      "提示词",
      "AI提示词参考",
      "AI生成参考",
      "AI 生成参考",
      "Prompt",
    ]);
    const voCol = colIndex(headers, ["口播文案", "口播", "口播/音效", "台词"]);

    const index = parseShotRowIndex(idxCol >= 0 ? cells[idxCol] : cells[0]);
    if (!Number.isFinite(index) || index <= 0) continue;

    const timeSlice = (timeCol >= 0 ? cells[timeCol] : "").trim() || `${index}`;
    const refImageLabel = (refCol >= 0 ? cells[refCol] : "").trim() || `图${index}`;
    const durationSec = parseDurationSec(timeCol >= 0 ? cells[timeCol] : timeSlice);
    const camera = (camCol >= 0 ? cells[camCol] : "").trim();
    const scene = (descCol >= 0 ? cells[descCol] : "").trim();
    const merged = (mergedCol >= 0 ? cells[mergedCol] : "").trim();
    const sceneDescription = [camera, scene || merged].filter(Boolean).join(" · ");

    shots.push({
      index,
      timeSlice,
      refImageId: "",
      refImageLabel,
      sceneDescription,
      videoPrompt: (promptCol >= 0 ? cells[promptCol] : cells[cells.length - 2] ?? "").trim(),
      voiceover: (voCol >= 0 ? cells[voCol] : cells[cells.length - 1] ?? "").trim(),
      durationSec,
    });
  }

  return shots.sort((a, b) => a.index - b.index);
}

export type UnifiedShotSequenceRow = {
  index: number;
  timeSlice: string;
  refImageLabel: string;
  sceneDescription: string;
  videoPrompt: string;
  voiceover: string;
  durationSec: number;
};

/** 表 A：镜号｜时间｜参考素材｜画面设计｜[AI视频生成提示词]｜口播文案 */
export function parseUnifiedShotSequenceTable(
  markdown: string,
  opts?: { requireAiPrompt?: boolean },
): UnifiedShotSequenceRow[] {
  const requireAiPrompt = opts?.requireAiPrompt === true;
  const lines = markdown.split("\n");
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];
  let headers: string[] | null = null;
  let rows: string[][] = [];

  const flush = () => {
    if (headers && rows.length > 0) tables.push({ headers, rows });
    headers = null;
    rows = [];
  };

  for (const line of lines) {
    const cells = parseTableRow(line);
    if (cells.length < 2) {
      flush();
      continue;
    }
    if (!headers) {
      if (isSeparatorRow(cells)) continue;
      headers = cells;
      continue;
    }
    if (isSeparatorRow(cells)) continue;
    rows.push(cells);
  }
  flush();

  for (const table of tables) {
    const joined = table.headers.join("");
    if (/配置项/.test(joined) && /参数详情/.test(joined)) continue;
    const idxCol = colIndex(table.headers, ["镜号", "镜头", "序号", "分镜"]);
    const timeCol = colIndex(table.headers, ["时间", "时间切片", "时长"]);
    const refCol = colIndex(table.headers, ["参考素材", "参考素材图", "参考图", "画面素材", "素材"]);
    const sceneCol = colIndex(table.headers, ["画面设计", "画面描述", "镜头描述", "画面"]);
    const promptCol = colIndex(table.headers, [
      "AI视频生成提示词",
      "AI 视频生成提示词",
      "视频提示词",
      "AI提示词",
    ]);
    const voCol = colIndex(table.headers, ["口播文案", "口播", "台词"]);

    const hasShotHeader =
      idxCol >= 0 &&
      (timeCol >= 0 || sceneCol >= 0 || refCol >= 0) &&
      !/配置项/.test(joined);
    if (!hasShotHeader) continue;
    if (requireAiPrompt && promptCol < 0) continue;

    const shots: UnifiedShotSequenceRow[] = [];
    for (const cells of table.rows) {
      const index = parseShotRowIndex(idxCol >= 0 ? cells[idxCol] : cells[0]);
      if (!Number.isFinite(index) || index <= 0) continue;
      const timeSlice = (timeCol >= 0 ? cells[timeCol] : "").trim() || `${index}`;
      const refImageLabel = (refCol >= 0 ? cells[refCol] : "").trim() || `图${index}`;
      const sceneDescription = (sceneCol >= 0 ? cells[sceneCol] : "").trim();
      const videoPrompt = (promptCol >= 0 ? cells[promptCol] : "").trim();
      const voiceover = (voCol >= 0 ? cells[voCol] : cells[cells.length - 1] ?? "").trim();
      shots.push({
        index,
        timeSlice,
        refImageLabel,
        sceneDescription,
        videoPrompt,
        voiceover,
        durationSec: parseDurationSec(timeSlice),
      });
    }
    if (shots.length >= 1) return shots.sort((a, b) => a.index - b.index);
  }

  return [];
}

/** 解析「配置项 | 参数详情」两列表（表 B） */
function parseConfigDetailTable(markdown: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = markdown.split("\n");
  let headers: string[] | null = null;

  for (const line of lines) {
    const cells = parseTableRow(line);
    if (cells.length < 2) continue;
    if (!headers) {
      if (isSeparatorRow(cells)) continue;
      const joined = cells.join("");
      if (!joined.includes("配置项") && !joined.includes("参数详情") && !joined.includes("参数")) {
        continue;
      }
      headers = cells;
      continue;
    }
    if (isSeparatorRow(cells)) continue;

    const keyCol = colIndex(headers, ["配置项", "项目", "参数项", "字段"]);
    const valCol = colIndex(headers, ["参数详情", "详情", "内容", "参数", "值"]);
    const key = (cells[keyCol >= 0 ? keyCol : 0] ?? "").trim();
    const val = (cells[valCol >= 0 ? valCol : 1] ?? "").trim();
    if (key && val) map.set(key.replace(/\s+/g, ""), val);
  }

  return map;
}

function pickConfigValue(map: Map<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    const norm = alias.replace(/\s+/g, "");
    for (const [k, v] of map) {
      if (k === norm || k.includes(norm) || norm.includes(k)) return v;
    }
  }
  return "";
}

function parseDurationFromText(raw: string): number {
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  const n = parseFloat(m[1]!);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function parseSeedVideoDirectFromMarkdown(markdown: string): SeedVideoDirectPlan | null {
  const patch = extractSeedVideoStructuredPatch(markdown);
  if (patch?.directPlan) {
    const fromStructured = directPlanFromStructuredPatch(patch);
    if (fromStructured) return fromStructured;
  }

  const kv = parseConfigDetailTable(markdown);
  const shotRows = parseUnifiedShotSequenceTable(markdown, { requireAiPrompt: false });

  let globalPrompt = "";
  let fullVoiceover = "";
  let bgmPreset = "";
  let voiceTone = "";
  let materialUsage = "";
  let durationSec = 0;
  let aspectRatio = "9:16";

  if (kv.size >= 2) {
    globalPrompt = pickConfigValue(kv, [
      "全局AI生成提示词",
      "全局AI提示词",
      "全局视频提示词",
      "AI视频生成提示词",
    ]);
    fullVoiceover = pickConfigValue(kv, ["口播文案", "完整连贯口播", "完整口播"]);
    bgmPreset = pickConfigValue(kv, ["背景音乐", "BGM"]);
    voiceTone = pickConfigValue(kv, ["配音音色", "音色"]);
    materialUsage = pickConfigValue(kv, ["素材运用", "素材引用", "素材顺序"]);
    const aspectRaw = pickConfigValue(kv, ["画幅比例", "画幅", "比例"]);
    const durRaw = pickConfigValue(kv, ["视频时长", "总时长", "时长"]);
    durationSec = parseDurationFromText(durRaw);
    const aspectMatch = aspectRaw.match(/\b(9:16|16:9)\b/) ?? markdown.match(/\b(9:16|16:9)\b/);
    aspectRatio = aspectMatch?.[1] ?? aspectMatch?.[0] ?? "9:16";
  }

  if (!fullVoiceover && shotRows.length > 0) {
    fullVoiceover = shotRows
      .map((s) => s.voiceover.trim())
      .filter(Boolean)
      .join("\n");
  }

  if (!durationSec && shotRows.length > 0) {
    durationSec = shotRows.reduce((sum, s) => sum + s.durationSec, 0);
  }
  if (!durationSec) {
    durationSec = parseDurationFromText(markdown.match(/总时长[^\d]*(\d+)\s*秒/)?.[0] ?? "") || ECOM_SEED_VIDEO_DEFAULT_TARGET_DURATION_SEC;
  }

  if (!globalPrompt && !fullVoiceover && shotRows.length === 0) {
    return parseSeedVideoDirectFromMarkdownLegacy(markdown);
  }

  if (!globalPrompt && fullVoiceover) globalPrompt = fullVoiceover;

  const shotSequence = shotRows.map((s) => ({
    index: s.index,
    timeSlice: s.timeSlice,
    refImageLabel: s.refImageLabel,
    sceneDescription: s.sceneDescription,
    voiceover: s.voiceover,
    durationSec: s.durationSec,
  }));

  if (!globalPrompt.trim() && !fullVoiceover.trim() && shotSequence.length === 0) {
    return null;
  }

  return {
    globalPrompt,
    fullVoiceover,
    aspectRatio,
    durationSec,
    bgmPreset,
    voiceTone,
    materialUsage,
    shotSequence: shotSequence.length > 0 ? shotSequence : undefined,
  };
}

function parseSeedVideoDirectFromMarkdownLegacy(markdown: string): SeedVideoDirectPlan | null {
  const extractSection = (headingPattern: RegExp): string => {
    const m = markdown.match(
      new RegExp(
        `(?:^|\\n)(?:#{1,3}\\s*)?(?:\\d+\\.\\s*)?${headingPattern.source}[^\\n]*\\n([\\s\\S]+?)(?=\\n(?:#{1,3}\\s*)?(?:\\d+\\.\\s*)?(?:口播|镜头|时长|画幅|BGM|请确认)|$)`,
        headingPattern.flags,
      ),
    );
    return m?.[1]?.trim() ?? "";
  };

  let globalPrompt =
    extractSection(/(?:全局\s*AI\s*(?:生成)?(?:视频)?提示词|全局(?:视频)?提示词)/i) ||
    markdown.match(/(?:全局|AI)?视频提示词[：:]\s*([\s\S]+?)(?:\n#{1,3}|\n完整口播|\n画幅|$)/i)?.[1]?.trim() ||
    "";

  let fullVoiceover = "";
  const voSection =
    extractSection(/口播与音频配置/i) ||
    markdown.match(/(?:完整|连贯)?口播文案[：:]\s*([\s\S]+?)(?:\n#{1,3}|\n画幅|\nBGM|$)/i)?.[1]?.trim() ||
    "";

  if (voSection) {
    const voBlock =
      voSection.match(/口播文案[^\n]*\n([\s\S]+?)(?:\n(?:音色|背景音乐|音效|BGM)|$)/i)?.[1]?.trim() ||
      voSection;
    const lines = voBlock
      .split("\n")
      .map((l) => l.replace(/^[-*•\d.、)\]]+\s*/, "").trim())
      .filter((l) => l && !/^(音色|背景音乐|音效|BGM)[：:]/.test(l));
    fullVoiceover = lines.join("\n").trim();
  }

  if (!globalPrompt && !fullVoiceover) return null;

  const durFromPlan = markdown.match(/总时长[^\d]*(\d+)\s*秒/);
  const durFromTable = [...markdown.matchAll(/\|\s*\d+\s*\|\s*[^|]+\|\s*(\d+)\s*s/gi)].reduce(
    (sum, m) => sum + parseInt(m[1]!, 10),
    0,
  );
  const durationSec = durFromPlan
    ? parseInt(durFromPlan[1]!, 10)
    : durFromTable > 0
      ? durFromTable
      : ECOM_SEED_VIDEO_DEFAULT_TARGET_DURATION_SEC;

  const aspectMatch = markdown.match(/\b(9:16|16:9)\b/);
  const bgmMatch = markdown.match(/背景音乐[：:]\s*([^\n]+)/);

  return {
    globalPrompt: globalPrompt || fullVoiceover,
    fullVoiceover,
    aspectRatio: aspectMatch?.[1] ?? "9:16",
    durationSec:
      Number.isFinite(durationSec) && durationSec > 0
        ? durationSec
        : ECOM_SEED_VIDEO_DEFAULT_TARGET_DURATION_SEC,
    bgmPreset: bgmMatch?.[1]?.trim() ?? "",
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
