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
  shots?: Array<{
    index: number;
    timeSlice: string;
    refImageLabel: string;
    sceneDescription?: string;
    videoPrompt?: string;
    voiceover: string;
    durationSec?: number;
  }>;
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

export function toSeedVideoAssistantChatContent(
  fullText: string,
  options?: { streaming?: boolean },
): string {
  const streaming = options?.streaming ?? false;
  const patch = extractSeedVideoStructuredPatch(fullText);
  if (patch?.scripts?.length === 3) {
    return formatScriptsStepMarkdown(patch);
  }

  const stripped = stripSeedVideoFence(fullText);
  const fenceStarted = /```seed-video/i.test(fullText);
  const fenceComplete = isSeedVideoFenceComplete(fullText);

  // 流式输出中围栏尚未闭合：继续展示 Markdown，勿闪「解析失败」
  if (fenceStarted && (!fenceComplete || streaming)) {
    return stripped || fullText.trim();
  }

  if (fenceComplete && !patch) {
    return "结构化 JSON 解析失败或未通过校验，请让助手按 table-format.md 重新输出 ```seed-video 围栏。";
  }

  return stripped || fullText.trim();
}
