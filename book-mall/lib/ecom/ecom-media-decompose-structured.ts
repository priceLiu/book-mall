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

const storyboardRowSchema = z.object({
  shotNo: z.number().int().positive(),
  duration: z.string().default(""),
  shotSize: z.string().default(""),
  cameraMove: z.string().default(""),
  cameraAngle: z.string().default(""),
  composition: z.string().default(""),
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

export function extractMediaDecomposePatch(text: string): MediaDecomposePatch | null {
  const body = extractFenceBody(text);
  if (body) {
    const parsed = tryParseJson(body);
    if (parsed) {
      const safe = mediaDecomposePatchSchema.safeParse(parsed);
      if (safe.success) return safe.data;
    }
  }

  const start = text.lastIndexOf('{"mediaType"');
  if (start >= 0) {
    const end = text.lastIndexOf("}");
    if (end > start) {
      const parsed = tryParseJson(text.slice(start, end + 1));
      if (parsed) {
        const safe = mediaDecomposePatchSchema.safeParse(parsed);
        if (safe.success) return safe.data;
      }
    }
  }
  return null;
}

export function resolveMediaDecomposeParseError(fullText: string): string | null {
  const fenceStarted = /```media-decompose/i.test(fullText);
  const fenceComplete = isMediaDecomposeFenceComplete(fullText);
  const patch = extractMediaDecomposePatch(fullText);

  if (patch) return null;
  if (fenceStarted && !fenceComplete) return null;
  if (fenceComplete) {
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
  const lines: string[] = ["## 分镜拆解表", ""];
  lines.push(
    "| 镜号 | 时长 | 景别 | 运镜 | 镜头角度 | 构图方式 | 画面内容 | 人物动作 | 表情 | 字幕文案 | 配音台词 | 音效 | BGM | 转场 | 剪辑节奏 |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of patch.storyboardTable) {
    lines.push(
      `| ${row.shotNo} | ${escCell(row.duration)} | ${escCell(row.shotSize)} | ${escCell(row.cameraMove)} | ${escCell(row.cameraAngle)} | ${escCell(row.composition)} | ${escCell(row.visualContent)} | ${escCell(row.characterAction)} | ${escCell(row.expression)} | ${escCell(row.subtitle)} | ${escCell(row.voiceover)} | ${escCell(row.sfx)} | ${escCell(row.bgm)} | ${escCell(row.transition)} | ${escCell(row.editRhythm)} |`,
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
