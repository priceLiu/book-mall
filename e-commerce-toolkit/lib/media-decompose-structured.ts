/** 客户端围栏解析（与 book-mall ecom-media-decompose-structured 一致） */

import type { MediaDecomposePatch } from "@/lib/media-decompose-types";

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickNonEmptyAudioText(...candidates: (string | undefined)[]): string {
  for (const candidate of candidates) {
    const text = (candidate ?? "").trim();
    if (text && !isVisualPlaceholderText(text)) return text;
  }
  return "";
}

function pickVoiceoverByKeyPattern(obj: Record<string, unknown>): string {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (!text || isVisualPlaceholderText(text)) continue;
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes("字幕") && !lowerKey.includes("口播")) continue;
    if (/口播|配音|旁白|解说|台词|voiceover|narration|dubbing|spoken|audioscript/i.test(key)) {
      return text;
    }
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

function isVisualPlaceholderText(value: string): boolean {
  const t = value.trim();
  return !t || t === "无" || t === "—" || t === "-";
}

function coerceScenePrep(raw: unknown): { venue: string; fixedProps: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { venue: "", fixedProps: "" };
  }
  const o = raw as Record<string, unknown>;
  return {
    venue: pickString(o, ["venue", "场地", "场景", "拍摄场地"]),
    fixedProps: pickString(o, ["fixedProps", "固定道具", "props", "道具"]),
  };
}

function mergeAudioFields(row: Record<string, unknown>): {
  subtitle: string;
  voiceover: string;
} {
  let subtitle = pickString(row, ["subtitle", "字幕文案", "字幕", "onScreenText", "screenText"]);
  let voiceover = pickString(row, [
    "voiceover",
    "配音台词",
    "配音文案",
    "配音",
    "口播文案",
    "口播",
    "旁白",
    "旁白文案",
    "解说词",
    "解说",
    "台词",
    "对白",
    "narration",
    "dubbing",
    "spokenText",
    "audioScript",
  ]);

  for (const nestedKey of ["audioInfo", "audio", "音频", "audioTrack", "sound"]) {
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
        "配音文案",
        "配音",
        "口播文案",
        "口播",
        "旁白",
        "旁白文案",
        "解说词",
        "解说",
        "台词",
        "narration",
        "spokenText",
      ]);
  }

  voiceover = voiceover || pickVoiceoverByKeyPattern(row);

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
    lightingSetup: pickString(row, [
      "lightingSetup",
      "布光",
      "光影",
      "灯光",
      "lighting",
      "lighting_setup",
    ]),
    toneContrast: pickString(row, [
      "toneContrast",
      "影调",
      "色调对比",
      "tone_contrast",
      "colorTone",
    ]),
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
    visualStyle: pickString(o, ["visualStyle", "全片视觉风格", "视觉风格", "artStyle", "风格"]),
    globalColorTone: pickString(o, [
      "globalColorTone",
      "全片色调",
      "色调基调",
      "globalColor",
      "colorTone",
    ]),
    cameraLanguageSummary: pickString(o, [
      "cameraLanguageSummary",
      "运镜总述",
      "全片运镜",
      "cameraLanguage",
    ]),
    scenePrep: coerceScenePrep(o.scenePrep ?? o.场地准备 ?? o.shootingPrep),
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

export function effectiveDecomposeVoiceover(row: {
  subtitle?: string;
  voiceover?: string;
}): string {
  return (
    pickNonEmptyAudioText(row.voiceover) ||
    pickNonEmptyAudioText(row.subtitle)
  );
}

function normalizeMediaDecomposePatch(patch: MediaDecomposePatch): MediaDecomposePatch {
  if (patch.mediaType !== "video") return patch;
  return {
    ...patch,
    scenePrep: patch.scenePrep ?? { venue: "", fixedProps: "" },
    storyboardTable: patch.storyboardTable.map((row) => ({
      lightingSetup: row.lightingSetup ?? "",
      toneContrast: row.toneContrast ?? "",
      ...row,
      voiceover: effectiveDecomposeVoiceover(row),
    })),
  };
}

function validateMediaDecomposeVisualQuality(patch: MediaDecomposePatch): boolean {
  if (patch.mediaType !== "video") return true;
  if (isVisualPlaceholderText(patch.visualStyle) && isVisualPlaceholderText(patch.globalColorTone)) {
    return false;
  }
  if (patch.storyboardTable.length >= 2) {
    const weakLighting = patch.storyboardTable.filter((row) =>
      isVisualPlaceholderText(row.lightingSetup ?? ""),
    ).length;
    if (weakLighting > patch.storyboardTable.length / 2) return false;
  }
  return true;
}

function finalizeMediaDecomposePatch(patch: MediaDecomposePatch): MediaDecomposePatch {
  return normalizeMediaDecomposePatch(patch);
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
      if (!validateMediaDecomposeVisualQuality(payload)) return null;
      return finalizeMediaDecomposePatch(payload);
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
  // 结构化结果由 ResultPanel 渲染；此处仅作流式/失败兜底，不再依赖模型 Markdown
  if (patch) return "";
  const stripped = stripMediaDecomposeFence(fullText);
  const fenceStarted = /```media-decompose/i.test(fullText);
  const fenceComplete = /```media-decompose[\s\S]*?```/i.test(fullText);
  if (fenceStarted && (!fenceComplete || streaming)) {
    return stripped.trim() ? stripped : "正在生成结构化 JSON…";
  }
  return stripped || fullText.trim();
}
