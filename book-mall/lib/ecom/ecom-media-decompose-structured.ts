import { z } from "zod";

const lightingSchema = z.object({
  keyLight: z.string().default(""),
  fillLight: z.string().default(""),
  rimLight: z.string().default(""),
  ambientLight: z.string().default(""),
  direction: z.string().default(""),
  hardSoft: z.string().default(""),
  colorTemperature: z.string().default(""),
});

const elementsSchema = z.object({
  subject: z.string().default(""),
  subjectPose: z.string().default(""),
  sceneEnvironment: z.string().default(""),
  spatialPerspective: z.string().default(""),
  composition: z.string().default(""),
  equivalentFocalLength: z.string().default(""),
  shootingAngle: z.string().default(""),
  lighting: lightingSchema.default({}),
  materialTexture: z.string().default(""),
  colorSystem: z.string().default(""),
  atmosphere: z.string().default(""),
  detailNotes: z.string().default(""),
});

const liveActionReplicationSchema = z.object({
  cameraPlacement: z.string().default(""),
  lightingSetup: z.string().default(""),
  props: z.string().default(""),
  cameraParams: z.string().default(""),
});

const scenePrepSchema = z.object({
  venue: z.string().default(""),
  fixedProps: z.string().default(""),
});

const storyboardRowSchema = z.object({
  shotNo: z.number().int().positive(),
  duration: z.string().default(""),
  shotSize: z.string().default(""),
  cameraMove: z.string().default(""),
  cameraAngle: z.string().default(""),
  composition: z.string().default(""),
  lightingSetup: z.string().default(""),
  toneContrast: z.string().default(""),
  visualContent: z.string().default(""),
  characterAction: z.string().default(""),
  expression: z.string().default(""),
  subtitle: z.string().default(""),
  voiceover: z.string().default(""),
  sfx: z.string().default(""),
  bgm: z.string().default(""),
  transition: z.string().default(""),
  editRhythm: z.string().default(""),
});

const videoPatchSchema = z.object({
  mediaType: z.literal("video"),
  action: z.literal("decompose_complete"),
  visualStyle: z.string().default(""),
  globalColorTone: z.string().default(""),
  cameraLanguageSummary: z.string().default(""),
  scenePrep: scenePrepSchema.default({ venue: "", fixedProps: "" }),
  storyboardTable: z.array(storyboardRowSchema).min(1),
  narrativeLogic: z.string().default(""),
  beatPoints: z.string().default(""),
  replicableShootingScript: z.string().default(""),
});

const imagePatchSchema = z.object({
  mediaType: z.literal("image"),
  action: z.literal("decompose_complete"),
  elements: elementsSchema,
  positivePrompt: z.string().min(1),
  negativePrompt: z.string().default(""),
  liveActionReplication: liveActionReplicationSchema,
});

export const mediaDecomposePatchSchema = z.discriminatedUnion("mediaType", [
  videoPatchSchema,
  imagePatchSchema,
]);

export type MediaDecomposePatch = z.infer<typeof mediaDecomposePatchSchema>;

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

/** 视频拆解光影/色调质量校验；失败返回人类可读原因 */
export function validateMediaDecomposeVisualQuality(patch: MediaDecomposePatch): string | null {
  if (patch.mediaType !== "video") return null;

  const styleEmpty = isVisualPlaceholderText(patch.visualStyle);
  const toneEmpty = isVisualPlaceholderText(patch.globalColorTone);
  if (styleEmpty && toneEmpty) {
    return "缺少全片 visualStyle 与 globalColorTone（至少填写一项全片视觉风格或色调基调）";
  }

  if (patch.storyboardTable.length >= 2) {
    const weakLighting = patch.storyboardTable.filter((row) =>
      isVisualPlaceholderText(row.lightingSetup),
    ).length;
    if (weakLighting > patch.storyboardTable.length / 2) {
      return "超过半数镜头的 lightingSetup（布光）为空或为「无」；可见光影时须填写可观测布光描述";
    }
  }

  return null;
}

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
      "色调",
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

export function coerceMediaDecomposePayload(raw: unknown): unknown | null {
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

/** 口播展示/下游复刻：voiceover 为空时回退 subtitle（模型常只填字幕列） */
export function effectiveDecomposeVoiceover(row: {
  subtitle?: string;
  voiceover?: string;
}): string {
  return (
    pickNonEmptyAudioText(row.voiceover) ||
    pickNonEmptyAudioText(row.subtitle)
  );
}

export function normalizeMediaDecomposePatch(patch: MediaDecomposePatch): MediaDecomposePatch {
  if (patch.mediaType !== "video") return patch;
  return {
    ...patch,
    storyboardTable: patch.storyboardTable.map((row) => ({
      ...row,
      voiceover: effectiveDecomposeVoiceover(row),
    })),
  };
}

function finalizeMediaDecomposePatch(patch: MediaDecomposePatch): MediaDecomposePatch {
  return normalizeMediaDecomposePatch(patch);
}

function tryParseJson(body: string): unknown | null {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

export function stripMediaDecomposeFence(text: string): string {
  return text
    .replace(/```media-decompose[\s\S]*?```/gi, "")
    .replace(/```media-decompose[\s\S]*$/gi, "")
    .trim();
}

export function isMediaDecomposeFenceComplete(text: string): boolean {
  return /```media-decompose[\s\S]*?```/i.test(text);
}

function extractFenceBody(text: string): string | null {
  const closed = text.match(/```media-decompose\s*([\s\S]*?)```/i);
  if (closed?.[1]?.trim()) return closed[1].trim();
  const open = text.match(/```media-decompose\s*([\s\S]*)$/i);
  if (open?.[1]?.trim()) return open[1].trim();
  return null;
}

function parseMediaDecomposePatchFromParsed(parsed: unknown): MediaDecomposePatch | null {
  const coerced = coerceMediaDecomposePayload(parsed) ?? parsed;
  const safe = mediaDecomposePatchSchema.safeParse(coerced);
  if (!safe.success) return null;
  const qualityError = validateMediaDecomposeVisualQuality(safe.data);
  if (qualityError) return null;
  return finalizeMediaDecomposePatch(safe.data);
}

export function extractMediaDecomposePatch(text: string): MediaDecomposePatch | null {
  const body = extractFenceBody(text);
  if (body) {
    const parsed = tryParseJson(body);
    if (parsed) {
      const patch = parseMediaDecomposePatchFromParsed(parsed);
      if (patch) return patch;
    }
  }

  const start = text.lastIndexOf('{"mediaType"');
  if (start >= 0) {
    const end = text.lastIndexOf("}");
    if (end > start) {
      const parsed = tryParseJson(text.slice(start, end + 1));
      if (parsed) {
        const patch = parseMediaDecomposePatchFromParsed(parsed);
        if (patch) return patch;
      }
    }
  }
  return null;
}

function resolveVisualQualityParseError(text: string): string | null {
  const body = extractFenceBody(text);
  if (!body) return null;
  const parsed = tryParseJson(body);
  if (!parsed) return null;
  const coerced = coerceMediaDecomposePayload(parsed) ?? parsed;
  const safe = mediaDecomposePatchSchema.safeParse(coerced);
  if (!safe.success) return null;
  return validateMediaDecomposeVisualQuality(safe.data);
}

export function resolveMediaDecomposeParseError(fullText: string): string | null {
  const fenceStarted = /```media-decompose/i.test(fullText);
  const fenceComplete = isMediaDecomposeFenceComplete(fullText);
  const patch = extractMediaDecomposePatch(fullText);

  if (patch) return null;
  if (fenceStarted && !fenceComplete) return null;
  if (fenceComplete) {
    const visualError = resolveVisualQualityParseError(fullText);
    if (visualError) {
      return `结构化 JSON 光影/色调质量未达标：${visualError}。请按 table-format.md 重新输出 \`\`\`media-decompose 围栏。`;
    }
    return "结构化 JSON 解析失败或未通过校验，请按 table-format.md 重新输出 ```media-decompose 围栏。";
  }
  return "回复末尾缺少 ```media-decompose JSON 围栏。";
}

export function toMediaDecomposeDisplayContent(
  fullText: string,
  options?: { streaming?: boolean },
): string {
  const streaming = options?.streaming ?? false;
  const patch = extractMediaDecomposePatch(fullText);
  if (patch?.mediaType === "video" && patch.storyboardTable.length > 0) {
    return formatVideoDecomposeMarkdown(patch);
  }
  if (patch?.mediaType === "image") {
    return formatImageDecomposeMarkdown(patch);
  }

  const stripped = stripMediaDecomposeFence(fullText);
  const fenceStarted = /```media-decompose/i.test(fullText);
  const fenceComplete = isMediaDecomposeFenceComplete(fullText);

  if (fenceStarted && (!fenceComplete || streaming)) {
    return stripped || fullText.trim();
  }
  if (fenceComplete && !patch) {
    return resolveMediaDecomposeParseError(fullText) ?? stripped;
  }
  return stripped || fullText.trim();
}

function escCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formatVideoDecomposeMarkdown(patch: Extract<MediaDecomposePatch, { mediaType: "video" }>): string {
  const lines: string[] = ["## 全片视觉", ""];
  if (patch.visualStyle.trim()) lines.push(`- **视觉风格**：${patch.visualStyle}`);
  if (patch.globalColorTone.trim()) lines.push(`- **色调基调**：${patch.globalColorTone}`);
  if (patch.cameraLanguageSummary.trim()) lines.push(`- **运镜总述**：${patch.cameraLanguageSummary}`);
  if (patch.scenePrep.venue.trim()) lines.push(`- **场地**：${patch.scenePrep.venue}`);
  if (patch.scenePrep.fixedProps.trim()) lines.push(`- **固定道具**：${patch.scenePrep.fixedProps}`);
  lines.push("", "## 分镜拆解表", "");
  lines.push(
    "| 镜号 | 时长 | 景别 | 运镜 | 镜头角度 | 构图方式 | 布光 | 影调 | 画面内容 | 人物动作 | 表情 | 字幕文案 | 口播文案 | 音效 | BGM | 转场 | 剪辑节奏 |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of patch.storyboardTable) {
    lines.push(
      `| ${row.shotNo} | ${escCell(row.duration)} | ${escCell(row.shotSize)} | ${escCell(row.cameraMove)} | ${escCell(row.cameraAngle)} | ${escCell(row.composition)} | ${escCell(row.lightingSetup)} | ${escCell(row.toneContrast)} | ${escCell(row.visualContent)} | ${escCell(row.characterAction)} | ${escCell(row.expression)} | ${escCell(row.subtitle)} | ${escCell(row.voiceover)} | ${escCell(row.sfx)} | ${escCell(row.bgm)} | ${escCell(row.transition)} | ${escCell(row.editRhythm)} |`,
    );
  }
  lines.push("", "## 整体叙事逻辑拆解", "", patch.narrativeLogic, "", "## 镜头卡点要点", "", patch.beatPoints, "", "## 可复刻拍摄脚本", "", patch.replicableShootingScript);
  return lines.join("\n").trim();
}

function formatImageDecomposeMarkdown(patch: Extract<MediaDecomposePatch, { mediaType: "image" }>): string {
  const e = patch.elements;
  const l = e.lighting;
  const lines: string[] = [
    "## 画面要素拆解",
    "",
    `- **画面主体**：${e.subject}`,
    `- **主体姿态**：${e.subjectPose}`,
    `- **场景环境**：${e.sceneEnvironment}`,
    `- **空间透视**：${e.spatialPerspective}`,
    `- **构图方式**：${e.composition}`,
    `- **等效焦距**：${e.equivalentFocalLength}`,
    `- **拍摄角度**：${e.shootingAngle}`,
    `- **布光**：主光 ${l.keyLight}；辅光 ${l.fillLight}；轮廓光 ${l.rimLight}；环境光 ${l.ambientLight}；方向 ${l.direction}；软硬 ${l.hardSoft}；色温 ${l.colorTemperature}`,
    `- **材质质感**：${e.materialTexture}`,
    `- **色彩体系**：${e.colorSystem}`,
    `- **画面氛围**：${e.atmosphere}`,
    `- **细节**：${e.detailNotes}`,
    "",
    "## 正向生图 Prompt",
    "",
    patch.positivePrompt,
    "",
    "## 反向负面 Prompt",
    "",
    patch.negativePrompt,
    "",
    "## 实拍复刻方案",
    "",
    `- **机位**：${patch.liveActionReplication.cameraPlacement}`,
    `- **灯光**：${patch.liveActionReplication.lightingSetup}`,
    `- **道具**：${patch.liveActionReplication.props}`,
    `- **相机参数**：${patch.liveActionReplication.cameraParams}`,
  ];
  return lines.join("\n").trim();
}
