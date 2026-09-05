import { z } from "zod";

const audioInfoSchema = z.object({
  scriptSubtitle: z.string().min(1),
  vocalEmotion: z.string().min(1),
  ambientSound: z.string().min(1),
  fxAndBgm: z.string().min(1),
});

export const filmPullShootingPrepSchema = z.object({
  venue: z.string().min(1),
  costume: z.string().min(1),
  props: z.string().min(1),
  equipment: z.string().min(1),
});

export const filmPullShotSchema = z.object({
  shotNo: z.number().int().positive(),
  startTimeSec: z.number().nonnegative(),
  endTimeSec: z.number().positive(),
  durationSec: z.number().positive(),
  cutTransition: z.string().min(1),
  /** 入出点切法说明（动作切点、与下一镜衔接）；类型见 cutTransition */
  cutDetail: z.string().min(1),
  shotScale: z.string().min(1),
  cameraAngle: z.string().min(1),
  cameraMovement: z.string().min(1),
  focalLengthPerspective: z.string().min(1),
  composition: z.string().min(1),
  subjectBlocking: z.string().min(1),
  sightDirection: z.string().min(1),
  sceneEnvironment: z.string().min(1),
  foreMidBackLayer: z.string().min(1),
  dynamicProps: z.string().min(1),
  lightingSetup: z.string().min(1),
  toneContrast: z.string().min(1),
  narrativeFunction: z.string().min(1),
  audioInfo: audioInfoSchema,
  rhythmWeight: z.string().min(1),
  visualMetaphor: z.string().min(1),
  aiVisualPrompt: z.string().min(1),
});

const metaSchema = z.object({
  totalDurationSec: z.number().positive(),
  narrativeMainLine: z.string().min(1),
  editRhythmCurve: z.string().min(1),
  artStyle: z.string().min(1),
  audioDesignLogic: z.string().min(1),
  shotSequenceLogic: z.string().min(1),
  cameraLanguageSummary: z.string().min(1),
});

export const filmPullAnalyzePatchSchema = z.object({
  schemaVersion: z.literal(1),
  action: z.literal("analyze_complete"),
  meta: metaSchema,
  /** 全片拍摄准备（与 replicableShootingScript【准备】一致，结构化真源） */
  shootingPrep: filmPullShootingPrepSchema,
  narrativeLogic: z.string().min(1),
  beatPoints: z.string().min(1),
  replicableShootingScript: z.string().min(1),
  shots: z.array(filmPullShotSchema).min(1),
});

const renderGlobalConfigSchema = z.object({
  characterUnifiedStyle: z.string().min(1),
  globalLighting: z.string().min(1),
  resolution: z.string().min(1),
  fps: z.string().min(1),
  globalVisualTone: z.string().min(1),
});

export const filmPullRenderScriptPatchSchema = filmPullAnalyzePatchSchema.extend({
  action: z.literal("render_script_complete"),
  renderGlobalConfig: renderGlobalConfigSchema,
});

export type FilmPullShot = z.infer<typeof filmPullShotSchema>;
export type FilmPullShootingPrep = z.infer<typeof filmPullShootingPrepSchema>;
export type FilmPullAnalyzePatch = z.infer<typeof filmPullAnalyzePatchSchema>;
export type FilmPullRenderScriptPatch = z.infer<typeof filmPullRenderScriptPatchSchema>;

const FILM_PULL_TEXT_FALLBACK = "无";

export function isFilmPullPlaceholderText(value: string | undefined | null): boolean {
  if (typeof value !== "string") return true;
  const t = value.trim();
  return !t || t === FILM_PULL_TEXT_FALLBACK;
}

function repairJsonText(body: string): string {
  return body
    .replace(/\uFEFF/g, "")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");
}

function tryParseJson(body: string): unknown | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  for (const candidate of [trimmed, repairJsonText(trimmed)]) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // try repaired variant
    }
  }
  return null;
}

function coerceTextField(value: unknown, fallback = FILM_PULL_TEXT_FALLBACK): string {
  if (typeof value === "string") {
    const t = value.trim();
    return t || fallback;
  }
  if (value == null || value === false) return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value).trim() || fallback;
}

function coerceFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    const n = Number.parseFloat(t.replace(/[^\d.+-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function coerceAudioInfo(raw: unknown, shot: Record<string, unknown>) {
  const base =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    scriptSubtitle: coerceTextField(
      base.scriptSubtitle ?? shot.scriptSubtitle ?? shot.voiceover ?? shot.subtitle,
    ),
    vocalEmotion: coerceTextField(base.vocalEmotion ?? shot.vocalEmotion),
    ambientSound: coerceTextField(base.ambientSound ?? shot.ambientSound),
    fxAndBgm: coerceTextField(base.fxAndBgm ?? shot.fxAndBgm ?? shot.bgm),
  };
}

function coerceShot(raw: unknown, index: number): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const start = coerceFiniteNumber(s.startTimeSec) ?? 0;
  let end = coerceFiniteNumber(s.endTimeSec);
  let duration = coerceFiniteNumber(s.durationSec);
  if (end == null && duration != null) end = start + duration;
  if (duration == null && end != null) duration = Math.max(0.01, end - start);
  if (end == null) end = start + (duration ?? 1);
  if (duration == null || duration <= 0) duration = Math.max(0.01, end - start);
  if (end <= start) end = start + duration;

  return {
    shotNo: Math.max(1, Math.trunc(coerceFiniteNumber(s.shotNo) ?? index + 1)),
    startTimeSec: Math.max(0, start),
    endTimeSec: end,
    durationSec: duration,
    cutTransition: coerceTextField(s.cutTransition, "硬切"),
    cutDetail: coerceTextField(s.cutDetail),
    shotScale: coerceTextField(s.shotScale, "中景"),
    cameraAngle: coerceTextField(s.cameraAngle, "平视"),
    cameraMovement: coerceTextField(s.cameraMovement, "固定机位"),
    focalLengthPerspective: coerceTextField(s.focalLengthPerspective, "标准"),
    composition: coerceTextField(s.composition),
    subjectBlocking: coerceTextField(s.subjectBlocking),
    sightDirection: coerceTextField(s.sightDirection),
    sceneEnvironment: coerceTextField(s.sceneEnvironment),
    foreMidBackLayer: coerceTextField(s.foreMidBackLayer),
    dynamicProps: coerceTextField(s.dynamicProps),
    lightingSetup: coerceTextField(s.lightingSetup),
    toneContrast: coerceTextField(s.toneContrast),
    narrativeFunction: coerceTextField(s.narrativeFunction),
    audioInfo: coerceAudioInfo(s.audioInfo, s),
    rhythmWeight: coerceTextField(s.rhythmWeight, "中"),
    visualMetaphor: coerceTextField(s.visualMetaphor),
    aiVisualPrompt: coerceTextField(s.aiVisualPrompt),
  };
}

export function coerceFilmPullPayload(raw: unknown): unknown | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const action =
    o.action === "render_script_complete"
      ? "render_script_complete"
      : "analyze_complete";

  const shotsRaw = Array.isArray(o.shots) ? o.shots : [];
  const shots = shotsRaw
    .map((s, i) => coerceShot(s, i))
    .filter((s): s is Record<string, unknown> => s !== null);
  if (shots.length === 0) return null;

  const metaRaw =
    o.meta && typeof o.meta === "object" && !Array.isArray(o.meta)
      ? (o.meta as Record<string, unknown>)
      : {};
  const lastShot = shots[shots.length - 1]!;
  const totalDurationSec =
    coerceFiniteNumber(metaRaw.totalDurationSec) ??
    coerceFiniteNumber(lastShot.endTimeSec) ??
    1;

  const prepRaw =
    o.shootingPrep && typeof o.shootingPrep === "object" && !Array.isArray(o.shootingPrep)
      ? (o.shootingPrep as Record<string, unknown>)
      : {};

  const base = {
    schemaVersion: 1 as const,
    action,
    shootingPrep: {
      venue: coerceTextField(prepRaw.venue),
      costume: coerceTextField(prepRaw.costume),
      props: coerceTextField(prepRaw.props),
      equipment: coerceTextField(prepRaw.equipment),
    },
    meta: {
      totalDurationSec: Math.max(0.01, totalDurationSec),
      narrativeMainLine: coerceTextField(metaRaw.narrativeMainLine),
      editRhythmCurve: coerceTextField(metaRaw.editRhythmCurve),
      artStyle: coerceTextField(metaRaw.artStyle),
      audioDesignLogic: coerceTextField(metaRaw.audioDesignLogic),
      shotSequenceLogic: coerceTextField(metaRaw.shotSequenceLogic),
      cameraLanguageSummary: coerceTextField(metaRaw.cameraLanguageSummary),
    },
    narrativeLogic: coerceTextField(o.narrativeLogic),
    beatPoints: coerceTextField(o.beatPoints),
    replicableShootingScript: coerceTextField(o.replicableShootingScript),
    shots,
  };

  if (action === "render_script_complete") {
    const cfgRaw =
      o.renderGlobalConfig && typeof o.renderGlobalConfig === "object"
        ? (o.renderGlobalConfig as Record<string, unknown>)
        : {};
    return {
      ...base,
      renderGlobalConfig: {
        characterUnifiedStyle: coerceTextField(cfgRaw.characterUnifiedStyle),
        globalLighting: coerceTextField(cfgRaw.globalLighting),
        resolution: coerceTextField(cfgRaw.resolution, "1080p"),
        fps: coerceTextField(cfgRaw.fps, "24fps"),
        globalVisualTone: coerceTextField(cfgRaw.globalVisualTone),
      },
    };
  }

  return base;
}

function formatZodIssueSummary(error: z.ZodError): string {
  return error.issues
    .slice(0, 4)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function extractFenceBody(text: string): string | null {
  const closed = text.match(/```film-pull\s*([\s\S]*?)```/i);
  if (closed?.[1]?.trim()) return closed[1].trim();
  for (const match of text.matchAll(/```json\s*([\s\S]*?)```/gi)) {
    const body = match[1]?.trim();
    if (body && body.includes('"schemaVersion"')) return body;
  }
  const open = text.match(/```film-pull\s*([\s\S]*)$/i);
  if (open?.[1]?.trim()) return open[1].trim();
  return null;
}

function extractJsonObject(text: string): unknown | null {
  const body = extractFenceBody(text);
  if (body) {
    const parsed = tryParseJson(body);
    if (parsed) return parsed;
  }
  const start = text.indexOf('{"schemaVersion"');
  if (start < 0) return null;
  const end = text.lastIndexOf("}");
  if (end <= start) return null;
  return tryParseJson(text.slice(start, end + 1));
}

function parseFilmPullPatch(
  text: string,
  schema: z.ZodTypeAny,
): { patch: unknown | null; validationHint: string | null } {
  const parsed = extractJsonObject(text);
  if (!parsed) {
    return { patch: null, validationHint: "JSON 语法错误或围栏为空" };
  }
  const coerced = coerceFilmPullPayload(parsed);
  if (!coerced) {
    return { patch: null, validationHint: "缺少 shots 或镜字段不可解析" };
  }
  const safe = schema.safeParse(coerced);
  if (safe.success) return { patch: safe.data, validationHint: null };
  return { patch: null, validationHint: formatZodIssueSummary(safe.error) };
}

export function extractFilmPullAnalyzePatch(text: string): FilmPullAnalyzePatch | null {
  return parseFilmPullPatch(text, filmPullAnalyzePatchSchema).patch as FilmPullAnalyzePatch | null;
}

export function extractFilmPullRenderScriptPatch(text: string): FilmPullRenderScriptPatch | null {
  return parseFilmPullPatch(text, filmPullRenderScriptPatchSchema).patch as
    | FilmPullRenderScriptPatch
    | null;
}

export function resolveFilmPullParseError(
  fullText: string,
  kind: "analyze" | "render_script",
): string | null {
  const fenceComplete = /```film-pull[\s\S]*?```/i.test(fullText);
  const schema =
    kind === "analyze" ? filmPullAnalyzePatchSchema : filmPullRenderScriptPatchSchema;
  const { patch, validationHint } = parseFilmPullPatch(fullText, schema);
  if (patch) return null;
  if (fenceComplete) {
    const hint = validationHint ? `（${validationHint}）` : "";
    return `结构化 JSON 解析失败或未通过校验${hint}，请按 table-format.md 重新输出 \`\`\`film-pull 围栏。`;
  }
  return "回复末尾缺少 ```film-pull JSON 围栏。";
}

export function stripFilmPullFence(text: string): string {
  return text
    .replace(/```film-pull[\s\S]*?```/gi, "")
    .replace(/```film-pull[\s\S]*$/gi, "")
    .trim();
}

function escCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function formatFilmPullAnalyzeMarkdown(patch: FilmPullAnalyzePatch): string {
  const lines: string[] = [
    "## 专业拉片 · 分镜总览",
    "",
    `- **总时长**：${patch.meta.totalDurationSec}s`,
    `- **叙事主线**：${patch.meta.narrativeMainLine}`,
    `- **剪辑节奏**：${patch.meta.editRhythmCurve}`,
    "",
    "| 镜号 | 时段(s) | 景别 | 运镜 | 机位 | 叙事功能 | aiVisualPrompt |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of patch.shots) {
    lines.push(
      `| ${row.shotNo} | ${row.startTimeSec}-${row.endTimeSec} | ${escCell(row.shotScale)} | ${escCell(row.cameraMovement)} | ${escCell(row.cameraAngle)} | ${escCell(row.narrativeFunction)} | ${escCell(row.aiVisualPrompt.slice(0, 80))}… |`,
    );
  }
  lines.push(
    "",
    "## 拍摄准备（shootingPrep）",
    "",
    `- **场地**：${patch.shootingPrep.venue}`,
    `- **服装**：${patch.shootingPrep.costume}`,
    `- **道具**：${patch.shootingPrep.props}`,
    `- **设备**：${patch.shootingPrep.equipment}`,
    "",
    "## 整体叙事逻辑拆解",
    "",
    patch.narrativeLogic,
    "",
    "## 镜头卡点要点",
    "",
    patch.beatPoints,
    "",
    "## 可复刻拍摄脚本",
    "",
    patch.replicableShootingScript,
  );
  return lines.join("\n").trim();
}

export function normalizeFilmPullShotsForDisplay(
  shots: FilmPullShot[],
): FilmPullShot[] {
  return shots.map((s, i) => ({
    ...s,
    shotNo: Number.isFinite(s.shotNo) && s.shotNo > 0 ? s.shotNo : i + 1,
  }));
}

export function assertRenderScriptInvariants(
  analyze: FilmPullAnalyzePatch,
  render: FilmPullRenderScriptPatch,
): void {
  if (analyze.shots.length !== render.shots.length) {
    throw new Error("渲染脚本镜数必须与拉片结果一致");
  }
  for (let i = 0; i < analyze.shots.length; i++) {
    const a = analyze.shots[i]!;
    const r = render.shots[i]!;
    if (a.shotNo !== r.shotNo) throw new Error(`镜 ${i + 1} 镜号不一致`);
    if (Math.abs(a.durationSec - r.durationSec) > 0.02) {
      throw new Error(`镜 ${a.shotNo} 时长不可变更`);
    }
    if (Math.abs(a.startTimeSec - r.startTimeSec) > 0.02) {
      throw new Error(`镜 ${a.shotNo} 起始时间不可变更`);
    }
    if (Math.abs(a.endTimeSec - r.endTimeSec) > 0.02) {
      throw new Error(`镜 ${a.shotNo} 结束时间不可变更`);
    }
  }
}

/** 拉片结构化质量校验（语法通过后）；失败信息供模型重试 */
export function validateFilmPullAnalyzeQuality(patch: FilmPullAnalyzePatch): string | null {
  const { shots, shootingPrep } = patch;
  if (shots.length === 0) return "shots 为空";

  if (isFilmPullPlaceholderText(shootingPrep.venue)) {
    return "shootingPrep.venue（拍摄场地）必填，须写可观测场地描述，禁止「无」";
  }

  const sceneEmpty = shots.filter((s) => isFilmPullPlaceholderText(s.sceneEnvironment)).length;
  if (sceneEmpty > shots.length / 2) {
    return "超过半数镜头的 sceneEnvironment（场景环境）仍为「无」；须按每镜可见环境填写，并与 shootingPrep.venue 一致";
  }

  const coreVisualEmpty = shots.filter(
    (s) =>
      isFilmPullPlaceholderText(s.subjectBlocking) &&
      isFilmPullPlaceholderText(s.lightingSetup) &&
      isFilmPullPlaceholderText(s.foreMidBackLayer),
  ).length;
  if (coreVisualEmpty === shots.length) {
    return "所有镜头的主体调度/布光/前中后景均为「无」；须从视频中填写可观测内容";
  }

  if (
    !isFilmPullPlaceholderText(shootingPrep.props) &&
    shots.every((s) => isFilmPullPlaceholderText(s.dynamicProps))
  ) {
    return "shootingPrep.props 已填写道具清单，但全部镜头的 dynamicProps 仍为「无」；须在出现道具的镜头填写";
  }

  if (shots.length > 1) {
    const lastIdx = shots.length - 1;
    const missingCutDetail = shots.filter(
      (s, i) => i < lastIdx && isFilmPullPlaceholderText(s.cutDetail),
    ).length;
    if (missingCutDetail > Math.floor((shots.length - 1) / 2)) {
      return "多数非末镜缺少 cutDetail（入出点/动作切点说明）；卡点细节须写入 cutDetail，不能只写在 beatPoints 长文";
    }
  }

  if (
    isFilmPullPlaceholderText(patch.meta.editRhythmCurve) &&
    !isFilmPullPlaceholderText(patch.beatPoints)
  ) {
    return "beatPoints 已写剪辑卡点，但 meta.editRhythmCurve 仍为「无」；全片节奏曲线须写入 meta";
  }

  return null;
}
