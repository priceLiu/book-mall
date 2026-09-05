import { z } from "zod";

import type {
  SeedVideoDirectPlan,
  SeedVideoDirectShotPreview,
  SeedVideoScript,
  SeedVideoScriptRow,
  SeedVideoShot,
} from "@/lib/ecom/ecom-seed-video-types";

const SCRIPT_LABELS = ["脚本一", "脚本二", "脚本三"] as const;
const SCRIPT_IDS = ["script-1", "script-2", "script-3"] as const;

const materialRowSchema = z.object({
  ref: z.string().min(1),
  description: z.string().default(""),
});

const materialAnalysisSchema = z.object({
  productSummary: z.string().default(""),
  sellingPoints: z.array(z.string()).default([]),
  sceneTags: z.array(z.string()).default([]),
  styleTone: z.string().default(""),
  materials: z.array(materialRowSchema).optional(),
});

const scriptRowSchema = z.object({
  beatIndex: z.number().int().positive(),
  durationSec: z.number().positive().optional(),
  duration: z.string().optional(),
  refImageLabel: z.string().min(1),
  sceneDescription: z.string().optional(),
  voiceover: z.string().default(""),
});

const scriptSchema = z.object({
  id: z.enum(SCRIPT_IDS),
  label: z.enum(SCRIPT_LABELS).optional(),
  title: z.string().min(1),
  summary: z.string().optional(),
  rows: z.array(scriptRowSchema).min(1),
});

const directShotSchema = z.object({
  index: z.number().int().positive(),
  timeSlice: z.string().min(1),
  refImageLabel: z.string().min(1),
  sceneDescription: z.string().default(""),
  voiceover: z.string().default(""),
  durationSec: z.number().positive().optional(),
});

const configTableSchema = z.object({
  globalPrompt: z.string().default(""),
  fullVoiceover: z.string().default(""),
  voiceTone: z.string().default(""),
  bgmPreset: z.string().default(""),
  durationSec: z.number().positive().optional(),
  aspectRatio: z.string().optional(),
  materialUsage: z.string().default(""),
});

const modeOptionSchema = z.object({
  id: z.enum(["direct", "fine"]),
  label: z.string().min(1),
  description: z.string().optional(),
});

const styleOptionSchema = z.object({
  id: z.enum(["sweet-xhs", "sharp-douyin"]),
  label: z.string().min(1),
  voiceLabel: z.string().optional(),
  bgmLabel: z.string().optional(),
  copyTone: z.string().optional(),
});

const directPlanPayloadSchema = z.object({
  shotSequence: z.array(directShotSchema).min(1).optional(),
  configTable: configTableSchema.optional(),
});

const formalShotSchema = z.object({
  index: z.number().int().positive(),
  timeSlice: z.string().min(1),
  refImageLabel: z.string().min(1),
  sceneDescription: z.string().default(""),
  videoPrompt: z.string().default(""),
  voiceover: z.string().default(""),
  durationSec: z.number().positive().optional(),
});

export const seedVideoStructuredPatchSchema = z
  .object({
    step: z
      .enum(["material", "scripts", "mode", "style", "directPlan", "storyboard", "formalShots"])
      .optional(),
    action: z.string().optional(),
    materialAnalysis: materialAnalysisSchema.optional(),
    scripts: z.array(scriptSchema).optional(),
    modeOptions: z.array(modeOptionSchema).optional(),
    styleOptions: z.array(styleOptionSchema).optional(),
    directPlan: directPlanPayloadSchema.optional(),
    shotSequence: z.array(directShotSchema).optional(),
    shots: z.array(formalShotSchema).optional(),
    configTable: configTableSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.step === "scripts" || (val.scripts && val.scripts.length > 0)) {
      if (!val.scripts || val.scripts.length !== 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "scripts 必须恰好 3 项",
          path: ["scripts"],
        });
        return;
      }
      const expected: Array<{ id: (typeof SCRIPT_IDS)[number]; label: (typeof SCRIPT_LABELS)[number] }> =
        [
          { id: "script-1", label: "脚本一" },
          { id: "script-2", label: "脚本二" },
          { id: "script-3", label: "脚本三" },
        ];
      val.scripts.forEach((s, i) => {
        const exp = expected[i];
        if (!exp || s.id !== exp.id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `scripts[${i}].id 必须为 ${exp?.id ?? "script-n"}`,
            path: ["scripts", i, "id"],
          });
        }
        if (s.label && s.label !== exp?.label) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `scripts[${i}].label 必须为 ${exp?.label ?? "脚本n"}`,
            path: ["scripts", i, "label"],
          });
        }
      });
    }
    if (val.step === "mode" && val.modeOptions && val.modeOptions.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "modeOptions 必须恰好 2 项",
        path: ["modeOptions"],
      });
    }
    if (val.step === "style" && val.styleOptions && val.styleOptions.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "styleOptions 必须恰好 2 项",
        path: ["styleOptions"],
      });
    }
  });

export type SeedVideoStructuredPatch = z.infer<typeof seedVideoStructuredPatchSchema>;

function tryParseJson(raw: string): unknown | null {
  const t = raw.trim();
  if (!t.startsWith("{")) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

/** 去掉 machine-readable 围栏（含流式未闭合） */
export function stripSeedVideoFence(text: string): string {
  return text
    .replace(/```seed-video[\s\S]*?```/gi, "")
    .replace(/```seed-video[\s\S]*$/gi, "")
    .replace(/```json[\s\S]*?"scripts"[\s\S]*?```/gi, "")
    .replace(/```json[\s\S]*?"scripts"[\s\S]*$/gi, "")
    .trim();
}

/** 围栏已闭合（流式未写完时为 false，避免误判为解析失败） */
export function isSeedVideoFenceComplete(text: string): boolean {
  return /```seed-video[\s\S]*?```/i.test(text);
}

function extractFenceBody(text: string): string | null {
  const closed = text.match(/```seed-video\s*([\s\S]*?)```/i);
  if (closed?.[1]?.trim()) return closed[1].trim();
  const open = text.match(/```seed-video\s*([\s\S]*)$/i);
  if (open?.[1]?.trim()) return open[1].trim();
  return null;
}

export function hasStructuredDirectPlan(text: string): boolean {
  const patch = extractSeedVideoStructuredPatch(text);
  return patch?.step === "directPlan" || Boolean(patch?.directPlan);
}

export function hasStructuredFormalShots(text: string): boolean {
  const patch = extractSeedVideoStructuredPatch(text);
  return patch?.step === "formalShots" || (patch?.shots?.length ?? 0) > 0;
}

export function extractSeedVideoStructuredPatch(text: string): SeedVideoStructuredPatch | null {
  const body = extractFenceBody(text);
  if (body) {
    const parsed = tryParseJson(body);
    if (parsed) {
      const safe = seedVideoStructuredPatchSchema.safeParse(parsed);
      if (safe.success) return safe.data;
    }
  }

  const start = text.lastIndexOf('{"step"');
  const altStart = text.lastIndexOf('{"materialAnalysis"');
  const altStart2 = text.lastIndexOf('{"scripts"');
  const idx = Math.max(start, altStart, altStart2);
  if (idx >= 0) {
    const end = text.lastIndexOf("}");
    if (end > idx) {
      const parsed = tryParseJson(text.slice(idx, end + 1));
      if (parsed) {
        const safe = seedVideoStructuredPatchSchema.safeParse(parsed);
        if (safe.success) return safe.data;
      }
    }
  }
  return null;
}

function parseRowDurationSec(row: z.infer<typeof scriptRowSchema>): number {
  if (row.durationSec != null && row.durationSec > 0) return Math.round(row.durationSec);
  const raw = row.duration ?? "";
  const range = raw.match(/(\d+(?:\.\d+)?)\s*[-~–—]\s*(\d+(?:\.\d+)?)/);
  if (range) {
    const a = parseFloat(range[1]!);
    const b = parseFloat(range[2]!);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) return Math.round(b - a);
  }
  const single = raw.match(/(\d+(?:\.\d+)?)/);
  if (single) {
    const n = parseFloat(single[1]!);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return 4;
}

export function scriptsFromStructuredPatch(
  patch: SeedVideoStructuredPatch,
): SeedVideoScript[] {
  if (!patch.scripts?.length) return [];
  return patch.scripts.map((s) => {
    const rows: SeedVideoScriptRow[] = s.rows.map((r) => ({
      beatIndex: r.beatIndex,
      durationSec: parseRowDurationSec(r),
      refImageLabel: r.refImageLabel.trim(),
      voiceover: r.voiceover.trim(),
    }));
    return {
      id: s.id,
      title: s.title.trim(),
      angle: s.title.trim(),
      targetPlatforms: [],
      totalDurationSec: rows.reduce((sum, r) => sum + r.durationSec, 0),
      rows,
    };
  });
}

export function directPlanFromStructuredPatch(
  patch: SeedVideoStructuredPatch,
): SeedVideoDirectPlan | null {
  const payload = patch.directPlan;
  if (!payload) return null;
  const cfg = payload.configTable;
  const shotSequence: SeedVideoDirectShotPreview[] | undefined = payload.shotSequence?.map(
    (s) => ({
      index: s.index,
      timeSlice: s.timeSlice,
      refImageLabel: s.refImageLabel,
      sceneDescription: s.sceneDescription,
      voiceover: s.voiceover,
      durationSec: s.durationSec ?? 4,
    }),
  );
  const durationFromShots = shotSequence?.reduce((s, r) => s + r.durationSec, 0);
  const fullVoiceover = cfg?.fullVoiceover?.trim() ?? "";
  let globalPrompt = cfg?.globalPrompt?.trim() ?? "";
  if (!globalPrompt && fullVoiceover) globalPrompt = fullVoiceover;
  if (!globalPrompt && shotSequence?.length) {
    globalPrompt = shotSequence
      .map((s) => s.sceneDescription.trim())
      .filter(Boolean)
      .join(" · ");
  }
  return {
    globalPrompt,
    fullVoiceover,
    aspectRatio: cfg?.aspectRatio ?? "9:16",
    durationSec: cfg?.durationSec ?? durationFromShots ?? 20,
    bgmPreset: cfg?.bgmPreset,
    voiceTone: cfg?.voiceTone,
    materialUsage: cfg?.materialUsage,
    shotSequence,
  };
}

export function shotsFromStructuredPatch(patch: SeedVideoStructuredPatch): SeedVideoShot[] {
  if (!patch.shots?.length) return [];
  return patch.shots.map((s) => ({
    index: s.index,
    timeSlice: s.timeSlice,
    refImageId: "",
    refImageLabel: s.refImageLabel,
    sceneDescription: s.sceneDescription,
    videoPrompt: s.videoPrompt,
    voiceover: s.voiceover,
    durationSec: s.durationSec ?? 4,
  }));
}

function escCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function formatMaterialAnalysisMarkdown(
  analysis: z.infer<typeof materialAnalysisSchema>,
): string {
  const materials =
    analysis.materials?.map((m) => `${m.ref}：${m.description}`).join("；") ?? "—";
  return [
    "## 素材解析",
    "",
    "| 维度 | 内容 |",
    "|------|------|",
    `| 商品概述 | ${escCell(analysis.productSummary || "—")} |`,
    `| 核心卖点 | ${escCell(analysis.sellingPoints.join("；") || "—")} |`,
    `| 场景/氛围 | ${escCell(analysis.sceneTags.join("；") || "—")} |`,
    `| 风格定位 | ${escCell(analysis.styleTone || "—")} |`,
    `| 素材说明 | ${escCell(materials)} |`,
  ].join("\n");
}

export function formatScriptsStepMarkdown(patch: SeedVideoStructuredPatch): string {
  const parts: string[] = [];
  if (patch.materialAnalysis) {
    parts.push(formatMaterialAnalysisMarkdown(patch.materialAnalysis));
  }
  for (const script of patch.scripts ?? []) {
    const labelIndex = script.id === "script-1" ? 0 : script.id === "script-2" ? 1 : 2;
    const label = script.label ?? SCRIPT_LABELS[labelIndex]!;
    parts.push("");
    parts.push(`## ${label}：${script.title}`);
    parts.push("");
    parts.push("| 分镜 | 时长 | 画面素材 | 口播文案 |");
    parts.push("|------|------|----------|----------|");
    for (const row of script.rows) {
      const dur =
        row.duration?.trim() ||
        (row.durationSec != null ? `${row.durationSec}s` : "5s");
      const mat = [row.refImageLabel, row.sceneDescription?.trim()]
        .filter(Boolean)
        .join(" ");
      parts.push(
        `| ${row.beatIndex} | ${escCell(dur)} | ${escCell(mat)} | ${escCell(row.voiceover)} |`,
      );
    }
  }
  parts.push("", "请选择脚本：");
  return parts.join("\n").trim();
}

function formatConfigTableMarkdown(
  cfg: z.infer<typeof configTableSchema> | undefined,
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
    durationSec?: number;
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

/** 由 JSON patch 生成助手气泡可读内容（模型可不写 Markdown） */
export function formatSeedVideoPatchMarkdown(patch: SeedVideoStructuredPatch): string | null {
  if (patch.scripts?.length === 3) {
    return formatScriptsStepMarkdown(patch);
  }
  if (patch.materialAnalysis && patch.step === "scripts") {
    return formatMaterialAnalysisMarkdown(patch.materialAnalysis);
  }
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
        formatShotSequenceMarkdown(patch.directPlan.shotSequence, {
          title: "### 镜头序列",
        }),
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

/** 助手气泡：隐藏围栏；有 JSON 时由 JSON 渲染可读内容 */
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

export function requireSeedVideoFence(text: string): SeedVideoStructuredPatch | null {
  if (!/```seed-video/.test(text)) return null;
  return extractSeedVideoStructuredPatch(text);
}
