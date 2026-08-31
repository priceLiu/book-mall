import { z } from "zod";

const audioInfoSchema = z.object({
  scriptSubtitle: z.string().default("无"),
  vocalEmotion: z.string().default("无"),
  ambientSound: z.string().default("无"),
  fxAndBgm: z.string().default("无"),
});

export const filmPullShotSchema = z.object({
  shotNo: z.number().int().positive(),
  startTimeSec: z.number().nonnegative(),
  endTimeSec: z.number().positive(),
  durationSec: z.number().positive(),
  cutTransition: z.string().min(1),
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
export type FilmPullAnalyzePatch = z.infer<typeof filmPullAnalyzePatchSchema>;
export type FilmPullRenderScriptPatch = z.infer<typeof filmPullRenderScriptPatchSchema>;

function tryParseJson(body: string): unknown | null {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function extractFenceBody(text: string): string | null {
  const closed = text.match(/```film-pull\s*([\s\S]*?)```/i);
  if (closed?.[1]?.trim()) return closed[1].trim();
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

export function extractFilmPullAnalyzePatch(text: string): FilmPullAnalyzePatch | null {
  const parsed = extractJsonObject(text);
  if (!parsed) return null;
  const safe = filmPullAnalyzePatchSchema.safeParse(parsed);
  return safe.success ? safe.data : null;
}

export function extractFilmPullRenderScriptPatch(text: string): FilmPullRenderScriptPatch | null {
  const parsed = extractJsonObject(text);
  if (!parsed) return null;
  const safe = filmPullRenderScriptPatchSchema.safeParse(parsed);
  return safe.success ? safe.data : null;
}

export function resolveFilmPullParseError(
  fullText: string,
  kind: "analyze" | "render_script",
): string | null {
  const fenceComplete = /```film-pull[\s\S]*?```/i.test(fullText);
  const patch =
    kind === "analyze"
      ? extractFilmPullAnalyzePatch(fullText)
      : extractFilmPullRenderScriptPatch(fullText);
  if (patch) return null;
  if (fenceComplete) {
    return "结构化 JSON 解析失败或未通过校验，请按 table-format.md 重新输出 ```film-pull 围栏。";
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
