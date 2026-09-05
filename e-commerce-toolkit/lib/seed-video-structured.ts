/** 与 book-mall `ecom-seed-video-structured.ts` 保持一致的客户端解析（勿改围栏名） */

import type { SeedVideoDirectPlan, SeedVideoShot } from "@/lib/seed-video-types";
import { SEED_VIDEO_DEFAULT_TARGET_DURATION_SEC } from "@/lib/seed-video-types";

export type SeedVideoStructuredScript = {
  id: "script-1" | "script-2" | "script-3";
  label: "脚本一" | "脚本二" | "脚本三";
  title: string;
  summary?: string;
  rows: Array<{
    beatIndex: number;
    durationSec?: number;
    duration?: string;
    refImageLabel: string;
    sceneDescription?: string;
    voiceover: string;
  }>;
};

export type SeedVideoStructuredPatch = {
  step?: string;
  action?: string;
  materialAnalysis?: {
    productSummary?: string;
    sellingPoints?: string[];
    sceneTags?: string[];
    styleTone?: string;
    materials?: Array<{ ref: string; description: string }>;
  };
  scripts?: SeedVideoStructuredScript[];
  modeOptions?: Array<{ id: string; label: string; description?: string }>;
  styleOptions?: Array<{
    id: string;
    label: string;
    voiceLabel?: string;
    bgmLabel?: string;
    copyTone?: string;
  }>;
  directPlan?: {
    shotSequence?: Array<{
      index: number;
      timeSlice: string;
      refImageLabel: string;
      sceneDescription?: string;
      voiceover: string;
      durationSec?: number;
    }>;
    configTable?: {
      globalPrompt?: string;
      fullVoiceover?: string;
      voiceTone?: string;
      bgmPreset?: string;
      durationSec?: number;
      aspectRatio?: string;
      materialUsage?: string;
    };
  };
  shotSequence?: Array<{
    index: number;
    timeSlice: string;
    refImageLabel: string;
    sceneDescription?: string;
    voiceover?: string;
    durationSec?: number;
  }>;
  shots?: Array<{
    index: number;
    timeSlice: string;
    refImageLabel: string;
    sceneDescription?: string;
    videoPrompt?: string;
    voiceover: string;
    durationSec?: number;
  }>;
  configTable?: {
    globalPrompt?: string;
    fullVoiceover?: string;
    voiceTone?: string;
    bgmPreset?: string;
    durationSec?: number;
    aspectRatio?: string;
    materialUsage?: string;
  };
};

function tryParseJson(raw: string): unknown | null {
  const t = raw.trim();
  if (!t.startsWith("{")) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

function extractLooseJsonObject(text: string, startIdx: number): string | null {
  if (startIdx < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(startIdx, i + 1);
    }
  }
  return null;
}

export function stripSeedVideoFence(text: string): string {
  return text
    .replace(/```seed-video[\s\S]*?```/gi, "")
    .replace(/```seed-video[\s\S]*$/gi, "")
    .trim();
}

/** 围栏已闭合（流式未写完时为 false，避免误判为解析失败） */
export function isSeedVideoFenceComplete(text: string): boolean {
  return /```seed-video[\s\S]*?```/i.test(text);
}

export function hasStructuredDirectPlan(text: string): boolean {
  const patch = extractSeedVideoStructuredPatch(text);
  return patch?.step === "directPlan" || Boolean(patch?.directPlan);
}

export function hasStructuredFormalShots(text: string): boolean {
  const patch = extractSeedVideoStructuredPatch(text);
  return patch?.step === "formalShots" || (patch?.shots?.length ?? 0) > 0;
}

export function resolveDirectPlanFromAssistantText(text: string): SeedVideoDirectPlan | null {
  const patch = extractSeedVideoStructuredPatch(text);
  const payload = patch?.directPlan;
  if (!payload) return null;
  const cfg = payload.configTable;
  const shotSequence = payload.shotSequence?.map((s) => ({
    index: s.index,
    timeSlice: s.timeSlice,
    refImageLabel: s.refImageLabel,
    sceneDescription: s.sceneDescription ?? "",
    voiceover: s.voiceover,
    durationSec: s.durationSec ?? 4,
  }));
  const durationFromShots = shotSequence?.reduce((sum, r) => sum + r.durationSec, 0);
  const fullVoiceover = cfg?.fullVoiceover?.trim() ?? "";
  let globalPrompt = cfg?.globalPrompt?.trim() ?? "";
  if (!globalPrompt && fullVoiceover) globalPrompt = fullVoiceover;
  if (!globalPrompt && shotSequence?.length) {
    globalPrompt = shotSequence
      .map((s) => s.sceneDescription.trim())
      .filter(Boolean)
      .join(" · ");
  }
  if (!globalPrompt && !fullVoiceover && !shotSequence?.length) return null;
  return {
    globalPrompt,
    fullVoiceover,
    aspectRatio: cfg?.aspectRatio ?? "9:16",
    durationSec: cfg?.durationSec ?? durationFromShots ?? SEED_VIDEO_DEFAULT_TARGET_DURATION_SEC,
    bgmPreset: cfg?.bgmPreset,
    voiceTone: cfg?.voiceTone,
    materialUsage: cfg?.materialUsage,
    shotSequence: shotSequence?.length ? shotSequence : undefined,
  };
}

export function resolveFormalShotsFromAssistantText(text: string): SeedVideoShot[] {
  const patch = extractSeedVideoStructuredPatch(text);
  if (!patch?.shots?.length) return [];
  return patch.shots.map((s) => ({
    index: s.index,
    timeSlice: s.timeSlice,
    refImageId: "",
    refImageLabel: s.refImageLabel,
    sceneDescription: s.sceneDescription ?? "",
    videoPrompt: s.videoPrompt ?? "",
    voiceover: s.voiceover,
    durationSec: s.durationSec ?? 4,
  }));
}

export function extractSeedVideoStructuredPatch(text: string): SeedVideoStructuredPatch | null {
  const closed = text.match(/```seed-video\s*([\s\S]*?)```/i);
  const open = text.match(/```seed-video\s*([\s\S]*)$/i);
  const body = closed?.[1]?.trim() || open?.[1]?.trim();
  if (body) {
    const parsed = tryParseJson(body);
    if (parsed && typeof parsed === "object") return parsed as SeedVideoStructuredPatch;
  }
  const markers = [
    '{"step"',
    '{"directPlan"',
    '{"shots"',
    '{"scripts"',
    '{"materialAnalysis"',
  ];
  let idx = -1;
  for (const marker of markers) {
    idx = Math.max(idx, text.lastIndexOf(marker));
  }
  if (idx >= 0) {
    const slice = extractLooseJsonObject(text, idx);
    if (slice) {
      const parsed = tryParseJson(slice);
      if (parsed && typeof parsed === "object") return parsed as SeedVideoStructuredPatch;
    }
  }
  return null;
}

/** 从 JSON 围栏生成脚本点选卡片数据 */
export function scriptProposalsFromStructuredPatch(
  patch: SeedVideoStructuredPatch,
): Array<{
  id: SeedVideoStructuredScript["id"];
  index: number;
  angle: string;
  summary: string;
}> {
  if (!patch.scripts || patch.scripts.length !== 3) return [];
  const expectedIds: SeedVideoStructuredScript["id"][] = ["script-1", "script-2", "script-3"];
  return patch.scripts
    .map((s, i) => {
      if (s.id !== expectedIds[i]) return null;
      const index = i;
      const vo = s.rows.find((r) => r.voiceover.trim())?.voiceover.trim() ?? "";
      const summaryRaw = s.summary?.trim() || vo;
      const summary = summaryRaw.length > 80 ? `${summaryRaw.slice(0, 80)}…` : summaryRaw;
      return {
        id: s.id,
        index,
        angle: s.title.trim(),
        summary,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => a.index - b.index);
}

function escCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function formatScriptsStepMarkdown(patch: SeedVideoStructuredPatch): string {
  const parts: string[] = [];
  if (patch.materialAnalysis) {
    const a = patch.materialAnalysis;
    const materials =
      a.materials?.map((m) => `${m.ref}：${m.description}`).join("；") ?? "—";
    parts.push(
      "## 素材解析",
      "",
      "| 维度 | 内容 |",
      "|------|------|",
      `| 商品概述 | ${escCell(a.productSummary ?? "—")} |`,
      `| 核心卖点 | ${escCell((a.sellingPoints ?? []).join("；") || "—")} |`,
      `| 场景/氛围 | ${escCell((a.sceneTags ?? []).join("；") || "—")} |`,
      `| 风格定位 | ${escCell(a.styleTone ?? "—")} |`,
      `| 素材说明 | ${escCell(materials)} |`,
    );
  }
  for (const script of patch.scripts ?? []) {
    parts.push("");
    parts.push(`## ${script.label}：${script.title}`);
    parts.push("");
    parts.push("| 分镜 | 时长 | 画面素材 | 口播文案 |");
    parts.push("|------|------|----------|----------|");
    for (const row of script.rows) {
      const dur = row.duration?.trim() || (row.durationSec != null ? `${row.durationSec}s` : "5s");
      const mat = [row.refImageLabel, row.sceneDescription?.trim()].filter(Boolean).join(" ");
      parts.push(
        `| ${row.beatIndex} | ${escCell(dur)} | ${escCell(mat)} | ${escCell(row.voiceover)} |`,
      );
    }
  }
  parts.push("", "请选择脚本：");
  return parts.join("\n").trim();
}

function formatConfigTableMarkdown(
  cfg: NonNullable<SeedVideoStructuredPatch["configTable"]> | undefined,
): string {
  if (!cfg) return "";
  return [
    "## 成片参数",
    "",
    "| 配置项 | 内容 |",
    "|--------|------|",
    `| 全局 AI 提示词 | ${escCell(cfg.globalPrompt || "—")} |`,
    `| 完整口播 | ${escCell(cfg.fullVoiceover || "—")} |`,
    `| 配音音色 | ${escCell(cfg.voiceTone || "—")} |`,
    `| 背景音乐 | ${escCell(cfg.bgmPreset || "—")} |`,
    `| 时长(秒) | ${cfg.durationSec ?? "—"} |`,
    `| 画幅 | ${escCell(cfg.aspectRatio || "—")} |`,
    `| 素材运用 | ${escCell(cfg.materialUsage || "—")} |`,
  ].join("\n");
}

function formatShotSequenceMarkdown(
  rows: Array<{
    index: number;
    timeSlice: string;
    refImageLabel: string;
    sceneDescription?: string;
    voiceover?: string;
    videoPrompt?: string;
  }>,
  opts?: { includeVideoPrompt?: boolean; title?: string; footer?: string },
): string {
  const includeVp = Boolean(opts?.includeVideoPrompt);
  const header = includeVp
    ? "| 镜号 | 时间 | 参考素材 | 画面设计 | AI视频生成提示词 | 口播文案 |"
    : "| 镜号 | 时间 | 参考素材 | 画面设计 | 口播文案 |";
  const sep = includeVp
    ? "| --- | --- | --- | --- | --- | --- |"
    : "| --- | --- | --- | --- | --- |";
  const lines = [opts?.title ?? "## 镜头序列", "", header, sep];
  for (const row of rows) {
    if (includeVp) {
      lines.push(
        `| ${row.index} | ${escCell(row.timeSlice)} | ${escCell(row.refImageLabel)} | ${escCell(row.sceneDescription ?? "")} | ${escCell(row.videoPrompt ?? "")} | ${escCell(row.voiceover ?? "")} |`,
      );
    } else {
      lines.push(
        `| ${row.index} | ${escCell(row.timeSlice)} | ${escCell(row.refImageLabel)} | ${escCell(row.sceneDescription ?? "")} | ${escCell(row.voiceover ?? "")} |`,
      );
    }
  }
  if (opts?.footer) lines.push("", opts.footer);
  return lines.join("\n").trim();
}

export function formatSeedVideoPatchMarkdown(patch: SeedVideoStructuredPatch): string | null {
  if (patch.scripts?.length === 3) return formatScriptsStepMarkdown(patch);
  if (patch.modeOptions?.length) {
    const lines = ["## 视频制作模式", ""];
    for (const opt of patch.modeOptions) {
      lines.push(`- **${opt.label}**${opt.description ? `：${opt.description}` : ""}`);
    }
    lines.push("", "请选择视频制作模式：");
    return lines.join("\n");
  }
  if (patch.styleOptions?.length) {
    const lines = ["## 成片风格", ""];
    for (const opt of patch.styleOptions) {
      const extras = [opt.voiceLabel, opt.bgmLabel, opt.copyTone].filter(Boolean).join(" · ");
      lines.push(`- **${opt.label}**${extras ? `（${extras}）` : ""}`);
    }
    lines.push("", "请选择成片风格：");
    return lines.join("\n");
  }
  if (patch.directPlan?.shotSequence?.length || patch.directPlan?.configTable) {
    const parts: string[] = ["## 直接连贯成片参数", ""];
    if (patch.directPlan.shotSequence?.length) {
      parts.push(
        formatShotSequenceMarkdown(patch.directPlan.shotSequence, { title: "### 镜头序列" }),
      );
      parts.push("");
    }
    const cfgMd = formatConfigTableMarkdown(patch.directPlan.configTable);
    if (cfgMd) parts.push(cfgMd);
    parts.push("", "请确认成片参数：");
    return parts.join("\n").trim();
  }
  if (patch.shotSequence?.length && patch.step === "storyboard") {
    return formatShotSequenceMarkdown(patch.shotSequence, {
      title: "## 分镜执行表",
      footer: "请确认分镜执行表：",
    });
  }
  if (patch.shots?.length) {
    const parts: string[] = [
      formatShotSequenceMarkdown(patch.shots, {
        includeVideoPrompt: true,
        title: "## 正式脚本（逐镜）",
      }),
    ];
    const cfgMd = formatConfigTableMarkdown(patch.configTable);
    if (cfgMd) {
      parts.push("");
      parts.push(cfgMd);
    }
    parts.push("", "请确认逐镜参数表：");
    return parts.join("\n").trim();
  }
  return null;
}

export function toSeedVideoAssistantChatContent(
  fullText: string,
  options?: { streaming?: boolean },
): string {
  const streaming = options?.streaming ?? false;
  const patch = extractSeedVideoStructuredPatch(fullText);
  if (patch) {
    const rendered = formatSeedVideoPatchMarkdown(patch);
    if (rendered) return rendered;
  }

  const stripped = stripSeedVideoFence(fullText);
  const fenceStarted = /```seed-video/i.test(fullText);
  const fenceComplete = isSeedVideoFenceComplete(fullText);

  if (fenceStarted && (!fenceComplete || streaming)) {
    return stripped.trim() ? stripped : "正在生成结构化 JSON…";
  }

  if (fenceComplete && !patch) {
    return "结构化 JSON 解析失败或未通过校验，请让助手按 table-format.md 重新输出 ```seed-video 围栏。";
  }

  return stripped || fullText.trim();
}
