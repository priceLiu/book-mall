/** 客户端围栏解析（与 book-mall ecom-media-decompose-structured 一致） */

import type { MediaDecomposePatch } from "@/lib/media-decompose-types";

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function coerceFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number.parseFloat(trimmed.replace(/[^\d.+-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function splitMarkdownTableRow(line: string): string[] {
  const parts = line.split("|").map((cell) => cell.trim());
  if (parts[0] === "") parts.shift();
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

function isMarkdownSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

function headerMatchesVoiceover(header: string): boolean {
  const h = header.trim().toLowerCase();
  return (
    h.includes("口播") ||
    h.includes("配音") ||
    h === "voiceover" ||
    h === "narration" ||
    h === "dubbing"
  );
}

function headerMatchesSubtitle(header: string): boolean {
  const h = header.trim().toLowerCase();
  return h.includes("字幕") || h === "subtitle";
}

function headerMatchesShotNo(header: string): boolean {
  const h = header.trim().toLowerCase();
  return h.includes("镜号") || h.includes("序号") || h === "shotno" || h === "index";
}

function parseMarkdownDecomposeVoiceoverMap(
  text: string,
): Map<number, { subtitle: string; voiceover: string }> {
  const map = new Map<number, { subtitle: string; voiceover: string }>();
  const lines = stripMediaDecomposeFence(text).split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line.startsWith("|")) continue;

    const headers = splitMarkdownTableRow(line);
    const shotIdx = headers.findIndex((h) => headerMatchesShotNo(h));
    const voiceoverIdx = headers.findIndex((h) => headerMatchesVoiceover(h));
    const subtitleIdx = headers.findIndex((h) => headerMatchesSubtitle(h));
    if (shotIdx < 0 || (voiceoverIdx < 0 && subtitleIdx < 0)) continue;

    i += 1;
    if (i < lines.length) {
      const maybeSep = splitMarkdownTableRow(lines[i]!.trim());
      if (isMarkdownSeparatorRow(maybeSep)) i += 1;
    }

    while (i < lines.length && lines[i]!.trim().startsWith("|")) {
      const cells = splitMarkdownTableRow(lines[i]!.trim());
      if (isMarkdownSeparatorRow(cells)) {
        i += 1;
        continue;
      }
      const shotNo = Math.round(coerceFiniteNumber(cells[shotIdx]) ?? NaN);
      if (Number.isFinite(shotNo) && shotNo > 0) {
        map.set(shotNo, {
          subtitle: subtitleIdx >= 0 ? (cells[subtitleIdx] ?? "").trim() : "",
          voiceover: voiceoverIdx >= 0 ? (cells[voiceoverIdx] ?? "").trim() : "",
        });
      }
      i += 1;
    }
  }

  return map;
}

function mergeAudioFields(row: Record<string, unknown>): {
  subtitle: string;
  voiceover: string;
} {
  let subtitle = pickString(row, ["subtitle", "字幕文案", "字幕", "onScreenText", "screenText"]);
  let voiceover = pickString(row, [
    "voiceover",
    "配音台词",
    "配音",
    "口播文案",
    "口播",
    "narration",
    "dubbing",
    "spokenText",
    "audioScript",
    "scriptSubtitle",
  ]);

  for (const nestedKey of ["audioInfo", "audio", "音频"]) {
    const nested = row[nestedKey];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    const audio = nested as Record<string, unknown>;
    subtitle =
      subtitle ||
      pickString(audio, ["subtitle", "字幕文案", "字幕", "onScreenText", "screenText"]);
    voiceover =
      voiceover ||
      pickString(audio, [
        "voiceover",
        "配音台词",
        "配音",
        "口播文案",
        "口播",
        "narration",
        "scriptSubtitle",
        "spokenText",
      ]);
  }

  return { subtitle, voiceover };
}

function coerceStoryboardRow(raw: unknown, index: number): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const shotNo = Math.max(
    1,
    Math.round(coerceFiniteNumber(row.shotNo ?? row.镜号 ?? row.index ?? row.序号) ?? index + 1),
  );
  const audio = mergeAudioFields(row);

  return {
    shotNo,
    duration: pickString(row, ["duration", "时长", "timeSlice", "time"]),
    shotSize: pickString(row, ["shotSize", "景别", "shot_size", "镜头景别"]),
    cameraMove: pickString(row, ["cameraMove", "运镜", "camera_move", "镜头运动"]),
    cameraAngle: pickString(row, ["cameraAngle", "镜头角度", "camera_angle"]),
    composition: pickString(row, ["composition", "构图方式", "构图"]),
    visualContent: pickString(row, ["visualContent", "画面内容", "visual_content", "画面"]),
    characterAction: pickString(row, ["characterAction", "人物动作", "character_action", "动作"]),
    expression: pickString(row, ["expression", "表情"]),
    subtitle: audio.subtitle,
    voiceover: audio.voiceover,
    sfx: pickString(row, ["sfx", "音效", "soundEffect"]),
    bgm: pickString(row, ["bgm", "BGM", "背景音乐"]),
    transition: pickString(row, ["transition", "转场"]),
    editRhythm: pickString(row, ["editRhythm", "剪辑节奏", "edit_rhythm", "rhythm"]),
  };
}

function coerceMediaDecomposePayload(raw: unknown): unknown | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const mediaType = o.mediaType === "image" ? "image" : o.mediaType === "video" ? "video" : null;
  if (!mediaType) return null;

  if (mediaType === "image") {
    return {
      ...o,
      mediaType: "image",
      action: "decompose_complete",
    };
  }

  const tableRaw = o.storyboardTable ?? o.storyboard ?? o.shots ?? o.分镜表 ?? o.table;
  const rows = Array.isArray(tableRaw) ? tableRaw : [];
  const storyboardTable = rows
    .map((row, i) => coerceStoryboardRow(row, i))
    .filter((row): row is Record<string, unknown> => row != null);

  return {
    mediaType: "video",
    action: "decompose_complete",
    storyboardTable,
    narrativeLogic: pickString(o, ["narrativeLogic", "整体叙事逻辑", "narrative"]),
    beatPoints: pickString(o, ["beatPoints", "镜头卡点要点", "beat"]),
    replicableShootingScript: pickString(o, [
      "replicableShootingScript",
      "可复刻拍摄脚本",
      "shootingScript",
    ]),
  };
}

function effectiveDecomposeVoiceover(row: { subtitle?: string; voiceover?: string }): string {
  return (row.voiceover ?? "").trim() || (row.subtitle ?? "").trim();
}

function enrichPatchFromMarkdown(text: string, patch: MediaDecomposePatch): MediaDecomposePatch {
  if (patch.mediaType !== "video") return patch;
  const mdMap = parseMarkdownDecomposeVoiceoverMap(text);
  if (mdMap.size === 0) return patch;

  return {
    ...patch,
    storyboardTable: patch.storyboardTable.map((row) => {
      const md = mdMap.get(row.shotNo);
      if (!md) return row;
      const subtitle = row.subtitle.trim() || md.subtitle;
      const voiceover =
        effectiveDecomposeVoiceover({ ...row, subtitle }) || md.voiceover || md.subtitle;
      return { ...row, subtitle, voiceover };
    }),
  };
}

function normalizeMediaDecomposePatch(patch: MediaDecomposePatch): MediaDecomposePatch {
  if (patch.mediaType !== "video") return patch;
  return {
    ...patch,
    storyboardTable: patch.storyboardTable.map((row) => ({
      ...row,
      voiceover: effectiveDecomposeVoiceover(row),
    })),
  };
}

function finalizeMediaDecomposePatch(text: string, patch: MediaDecomposePatch): MediaDecomposePatch {
  return enrichPatchFromMarkdown(text, normalizeMediaDecomposePatch(patch));
}

export function stripMediaDecomposeFence(text: string): string {
  return text
    .replace(/```media-decompose[\s\S]*?```/gi, "")
    .replace(/```media-decompose[\s\S]*$/gi, "")
    .trim();
}

export function extractMediaDecomposePatch(text: string): MediaDecomposePatch | null {
  const closed = text.match(/```media-decompose\s*([\s\S]*?)```/i);
  const body = closed?.[1]?.trim();
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const coerced = coerceMediaDecomposePayload(parsed) ?? parsed;
    const payload = coerced as MediaDecomposePatch;
    if (payload.mediaType === "video" && Array.isArray(payload.storyboardTable)) {
      return finalizeMediaDecomposePatch(text, payload);
    }
    if (payload.mediaType === "image" && "positivePrompt" in payload && payload.positivePrompt) {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}

export function toMediaDecomposeDisplayMarkdown(fullText: string, streaming?: boolean): string {
  const patch = extractMediaDecomposePatch(fullText);
  if (patch) {
    return stripMediaDecomposeFence(fullText) || fullText.trim();
  }
  const stripped = stripMediaDecomposeFence(fullText);
  const fenceStarted = /```media-decompose/i.test(fullText);
  const fenceComplete = /```media-decompose[\s\S]*?```/i.test(fullText);
  if (fenceStarted && (!fenceComplete || streaming)) {
    return stripped || fullText.trim();
  }
  return stripped || fullText.trim();
}
