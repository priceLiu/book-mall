import { z } from "zod";

import type { StoryboardSheet } from "./ecom-storyboard-types";
import { parseStoryboardSheet } from "./ecom-storyboard-types";
import type { StoryboardChatMessage } from "./ecom-storyboard-types";

/** @see book-mall/doc/ecom/fashion-deliverable-spec-v4.md */
export const FASHION_SCHEMA_VERSION = "fashion-v4" as const;

export const fashionVersionKeySchema = z.enum(["A", "B", "C", "D", "E"]);

export const fashionGenderCategorySchema = z.enum(["男装", "女装", "裙装"]);

export const fashionStyleAttributeSchema = z.enum([
  "职场办公",
  "日常休闲",
  "潮流街头",
  "户外机能",
  "极简高级",
  "温柔气质",
]);

export const fashionTierSchema = z.enum(["平价刚需", "中端质感", "高端轻奢"]);

export const fashionPlatformSchema = z.enum([
  "淘宝",
  "京东",
  "拼多多",
  "抖音",
  "小红书",
  "亚马逊",
  "TikTok Shop",
  "Shopee",
  "Lazada",
  "速卖通",
]);

export const fashionOutputLanguageSchema = z.enum([
  "中文",
  "英文",
  "西班牙语",
  "葡萄牙语",
  "阿拉伯语",
]);

export const fashionSevenDimensionsSchema = z.object({
  genderCategory: fashionGenderCategorySchema.optional(),
  styleCategory: z.string().min(1).optional(),
  styleAttribute: fashionStyleAttributeSchema.optional(),
  tier: fashionTierSchema.optional(),
  customScene: z.string().min(1).optional(),
  platform: fashionPlatformSchema.optional(),
  outputLanguage: fashionOutputLanguageSchema.optional(),
});

export const fashionSellpointLayerSchema = z.enum(["core", "visual", "aux"]);
export const fashionSellpointSourceSchema = z.enum(["user", "ai", "supplemented"]);

export const fashionSellpointSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  layer: fashionSellpointLayerSchema,
  source: fashionSellpointSourceSchema,
});

export const fashionVoiceoverSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  narrative: z.string().min(1),
  script: z.string().min(1),
});

export const fashionPanelRowSchema = z.object({
  index: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  shotScale: z.string().min(1),
  durationSec: z.number().positive(),
  cameraMove: z.string().min(1),
  sceneDesc: z.string().min(1),
  modelAction: z.string().min(1),
  garmentFocus: z.string().min(1),
  dialogue: z.string().optional(),
  toneTexture: z.string().optional(),
  sellpointIds: z.array(z.string()).default([]),
  imagePrompt: z.string().min(10),
});

export const fashionStoryboardVersionSchema = z.object({
  id: fashionVersionKeySchema,
  title: z.string().min(1),
  summary: z.string().optional(),
  panels: z.array(fashionPanelRowSchema).length(6),
  totalDurationSec: z.number().positive().optional(),
});

export const fashionCoverageRowSchema = z.object({
  sellpointId: z.string().min(1),
  sellpointText: z.string().min(1),
  layer: fashionSellpointLayerSchema,
  panelIndexes: z.array(z.number().int().positive()),
  covered: z.boolean(),
});

export const fashionOpsPackSchema = z.object({
  titles: z.array(z.string()).optional(),
  coverWords: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  xiaohongshuBody: z.string().optional(),
  detailBullets: z.array(z.string()).optional(),
});

export const fashionOutputModeSchema = z.enum(["script_compose", "direct_video"]);

export const fashionDeliverableSchema = z.object({
  schemaVersion: z.literal(FASHION_SCHEMA_VERSION),
  vertical: z.literal("fashion_apparel"),
  productName: z.string().min(1),
  dimensions: fashionSevenDimensionsSchema,
  sellpoints: z.array(fashionSellpointSchema).default([]),
  sellpointsLocked: z.boolean().default(false),
  voiceovers: z.array(fashionVoiceoverSchema).default([]),
  selectedVoiceoverId: z.string().nullable().optional(),
  storyboardVersions: z
    .record(fashionVersionKeySchema, fashionStoryboardVersionSchema)
    .optional(),
  selectedVersion: fashionVersionKeySchema.nullable().optional(),
  storyboardLocked: z.boolean().default(false),
  coverageChecklist: z.array(fashionCoverageRowSchema).default([]),
  opsPack: fashionOpsPackSchema.optional(),
  outputMode: fashionOutputModeSchema.nullable().optional(),
});

export type FashionDeliverable = z.infer<typeof fashionDeliverableSchema>;
export type FashionPanelRow = z.infer<typeof fashionPanelRowSchema>;
export type FashionStoryboardVersion = z.infer<typeof fashionStoryboardVersionSchema>;
export type FashionSellpoint = z.infer<typeof fashionSellpointSchema>;
export type FashionVoiceover = z.infer<typeof fashionVoiceoverSchema>;
export type FashionVersionKey = z.infer<typeof fashionVersionKeySchema>;

const SHOT_SCALE_BY_INDEX: Record<number, string> = {
  1: "全景/中全景",
  2: "中全景/中景",
  3: "中近景/近景",
  4: "近景/特写",
  5: "中景",
  6: "中全景",
};

function roundDuration(sec: number): number {
  return Math.round(sec * 2) / 2;
}

function coerceSellpointIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v).trim()).filter(Boolean);
}

function coerceFashionPanels(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((panel, idx) => {
    if (!panel || typeof panel !== "object") return panel;
    const p = panel as Record<string, unknown>;
    const index = typeof p.index === "number" ? p.index : idx + 1;
    const sceneDesc =
      typeof p.sceneDesc === "string" && p.sceneDesc.trim()
        ? p.sceneDesc.trim()
        : typeof p.scene === "string" && p.scene.trim()
          ? p.scene.trim()
          : "—";
    const modelAction =
      typeof p.modelAction === "string" && p.modelAction.trim()
        ? p.modelAction.trim()
        : typeof p.action === "string" && p.action.trim()
          ? p.action.trim()
          : sceneDesc;
    const garmentFocus =
      typeof p.garmentFocus === "string" && p.garmentFocus.trim()
        ? p.garmentFocus.trim()
        : typeof p.productBeat === "string" && p.productBeat.trim()
          ? p.productBeat.trim()
          : "服装展示";
    return {
      ...p,
      index,
      shotScale:
        typeof p.shotScale === "string" && p.shotScale.trim()
          ? p.shotScale.trim()
          : typeof p.shotType === "string" && p.shotType.trim()
            ? p.shotType.trim()
            : SHOT_SCALE_BY_INDEX[index] ?? "中景",
      durationSec:
        typeof p.durationSec === "number" && p.durationSec > 0
          ? roundDuration(p.durationSec)
          : 4,
      cameraMove:
        typeof p.cameraMove === "string" && p.cameraMove.trim()
          ? p.cameraMove.trim()
          : typeof p.camera === "string" && p.camera.trim()
            ? p.camera.trim()
            : "固定",
      sceneDesc,
      modelAction,
      garmentFocus,
      sellpointIds: coerceSellpointIds(p.sellpointIds),
      imagePrompt:
        typeof p.imagePrompt === "string" && p.imagePrompt.trim()
          ? p.imagePrompt.trim()
          : "竖版9:16，写实UGC摄影，服装展示，禁止画面文字。",
    };
  });
}

function coerceStoryboardVersions(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const key of ["A", "B", "C", "D", "E"]) {
    const version = obj[key];
    if (!version || typeof version !== "object") continue;
    const v = version as Record<string, unknown>;
    next[key] = {
      ...v,
      id: key,
      panels: coerceFashionPanels(v.panels),
    };
  }
  return next;
}

function coerceOpsPackText(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (raw == null) return "";
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const text =
      (typeof o.text === "string" && o.text.trim()) ||
      (typeof o.title === "string" && o.title.trim()) ||
      (typeof o.label === "string" && o.label.trim()) ||
      (typeof o.content === "string" && o.content.trim()) ||
      "";
    const type = typeof o.type === "string" ? o.type.trim() : "";
    if (text && type) return `${type}：${text}`;
    return text;
  }
  return String(raw).trim();
}

function coerceStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceOpsPackText).filter(Boolean);
}

function coerceOpsPack(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const ops = raw as Record<string, unknown>;
  return {
    ...ops,
    titles: coerceStringList(ops.titles),
    coverWords: coerceStringList(ops.coverWords),
    tags: coerceStringList(ops.tags),
    detailBullets: coerceStringList(ops.detailBullets),
    xiaohongshuBody:
      typeof ops.xiaohongshuBody === "string"
        ? ops.xiaohongshuBody.trim()
        : coerceOpsPackText(ops.xiaohongshuBody),
  };
}

function coerceFashionDeliverable(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  if (obj.storyboardVersions) {
    obj.storyboardVersions = coerceStoryboardVersions(obj.storyboardVersions);
  }
  if (Array.isArray(obj.sellpoints)) {
    obj.sellpoints = obj.sellpoints.map((sp, i) => {
      if (!sp || typeof sp !== "object") return sp;
      const s = sp as Record<string, unknown>;
      return {
        ...s,
        id:
          typeof s.id === "string" && s.id.trim()
            ? s.id.trim()
            : `S${String(i + 1).padStart(2, "0")}`,
      };
    });
  }
  if (obj.opsPack) {
    obj.opsPack = coerceOpsPack(obj.opsPack);
  }
  return obj;
}

function tryParseFashionCandidate(jsonRaw: string): FashionDeliverable | null {
  try {
    const parsed = coerceFashionDeliverable(JSON.parse(jsonRaw)) as Record<string, unknown>;
    const versions = parsed.storyboardVersions as Record<string, unknown> | undefined;
    const hasStoryboards =
      versions &&
      ["A", "B", "C", "D", "E"].some((k) => versions[k] && typeof versions[k] === "object");
    if (hasStoryboards && !parsed.opsPack && parsed.selectedVersion) {
      parsed.selectedVersion = null;
    }
    const result = fashionDeliverableSchema.safeParse(parsed);
    if (result.success) return result.data;
    if (
      parsed.schemaVersion === FASHION_SCHEMA_VERSION ||
      parsed.vertical === "fashion_apparel"
    ) {
      return parsed as FashionDeliverable;
    }
  } catch {
    /* */
  }
  return null;
}

export function readMetaFashionDeliverable(raw: unknown): FashionDeliverable | null {
  if (!raw || typeof raw !== "object") return null;
  const coerced = coerceFashionDeliverable(
    JSON.parse(JSON.stringify(raw)),
  ) as Record<string, unknown>;
  const result = fashionDeliverableSchema.safeParse(coerced);
  if (result.success) return result.data;
  if (
    coerced.schemaVersion === FASHION_SCHEMA_VERSION ||
    coerced.vertical === "fashion_apparel"
  ) {
    return coerced as FashionDeliverable;
  }
  return null;
}

export function hasFashionStoryboardConfirmInChat(
  chatHistory: StoryboardChatMessage[],
): boolean {
  return chatHistory.some(
    (m) =>
      m.role === "user" &&
      (m.content.trim() === "确认分镜，生成运营包" ||
        m.content.trim() === "重新生成运营包"),
  );
}

function isStoryboardConfirmAfterLastVersionPick(
  chatHistory: StoryboardChatMessage[],
): boolean {
  let lastVersionIdx = -1;
  let lastConfirmIdx = -1;
  for (let i = 0; i < chatHistory.length; i++) {
    const msg = chatHistory[i];
    if (msg?.role !== "user") continue;
    const trimmed = msg.content.trim();
    if (/^选择分镜\s*[A-E]版/.test(trimmed)) lastVersionIdx = i;
    if (
      trimmed === "确认分镜，生成运营包" ||
      trimmed === "重新生成运营包"
    ) {
      lastConfirmIdx = i;
    }
  }
  return lastConfirmIdx >= 0 && lastConfirmIdx > lastVersionIdx;
}

function hasFashionOutputModeChoiceInChat(
  chatHistory: StoryboardChatMessage[],
): boolean {
  return chatHistory.some(
    (m) =>
      m.role === "user" &&
      (m.content.trim() === "分镜脚本交付" ||
        m.content.trim() === "故事版一键成片"),
  );
}

export function stripFashionDeliverableFence(text: string): string {
  let out = text
    .replace(/```fashion-deliverable[\s\S]*?```/gi, "")
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();

  const jsonStart = out.search(
    /\{\s*"schemaVersion"\s*:\s*"fashion-v4"|\{\s*"vertical"\s*:\s*"fashion_apparel"/,
  );
  if (jsonStart >= 0) out = out.slice(0, jsonStart).trim();
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function extractFashionDeliverable(text: string): FashionDeliverable | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```fashion-deliverable\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = tryParseFashionCandidate(fenced[1].trim());
    if (parsed) return parsed;
  }

  const generic = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (generic?.[1]) {
    const parsed = tryParseFashionCandidate(generic[1].trim());
    if (parsed) return parsed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return tryParseFashionCandidate(trimmed.slice(start, end + 1));
  }
  return null;
}

export function isFashionDeliverable(raw: unknown): raw is FashionDeliverable {
  return fashionDeliverableSchema.safeParse(raw).success;
}

function hasMeaningfulOpsPack(d: FashionDeliverable): boolean {
  const ops = d.opsPack;
  if (!ops) return false;
  return Boolean(
    (ops.titles?.length ?? 0) > 0 ||
      (ops.coverWords?.length ?? 0) > 0 ||
      (ops.tags?.length ?? 0) > 0 ||
      (ops.detailBullets?.length ?? 0) > 0 ||
      Boolean(ops.xiaohongshuBody?.trim()),
  );
}

export function inferFashionPhaseFromDeliverable(
  d: FashionDeliverable,
  existingPhase?: string,
): string {
  if (!d.sellpoints?.length || !d.sellpointsLocked) return "sellpoints";
  if ((d.voiceovers?.length ?? 0) === 0) return "sellpoints";
  if (!d.selectedVoiceoverId) return "voiceover_pick";
  const storyboardVersionCount = (["A", "B", "C", "D", "E"] as const).filter((k) => {
    const v = d.storyboardVersions?.[k];
    return Boolean(v?.panels?.length || v?.title?.trim() || v?.summary?.trim());
  }).length;
  if (storyboardVersionCount === 0) return "voiceover_pick";
  if (!d.selectedVersion) return "storyboard_pick";
  if (!d.storyboardLocked) return "storyboard_confirm";
  if (!hasMeaningfulOpsPack(d)) return "storyboard_confirm";
  if (!d.outputMode) return "output_mode";
  return "produce";
}

function stripPrematureFashionDeliverableFields(d: FashionDeliverable): FashionDeliverable {
  if (!d.storyboardLocked) {
    return { ...d, opsPack: undefined, outputMode: null };
  }
  return d;
}

function sanitizePreLockFashionDeliverable(d: FashionDeliverable): FashionDeliverable {
  if (d.sellpointsLocked) return d;
  return {
    ...d,
    voiceovers: [],
    selectedVoiceoverId: null,
    storyboardVersions: {},
    selectedVersion: null,
    coverageChecklist: [],
  };
}

export function mergeFashionDeliverablePatch(
  existing: FashionDeliverable | null | undefined,
  patch: Partial<FashionDeliverable>,
  productName?: string,
): FashionDeliverable {
  const base: FashionDeliverable = existing ?? {
    schemaVersion: FASHION_SCHEMA_VERSION,
    vertical: "fashion_apparel",
    productName: productName?.trim() || "服装商品",
    dimensions: {},
    sellpoints: [],
    sellpointsLocked: false,
    voiceovers: [],
    selectedVoiceoverId: null,
    storyboardVersions: {},
    selectedVersion: null,
    storyboardLocked: false,
    coverageChecklist: [],
    outputMode: null,
  };

  const merged: FashionDeliverable = {
    ...base,
    ...patch,
    schemaVersion: FASHION_SCHEMA_VERSION,
    vertical: "fashion_apparel",
    productName: patch.productName?.trim() || base.productName,
    dimensions: (() => {
      const next = { ...base.dimensions };
      for (const [key, value] of Object.entries(patch.dimensions ?? {})) {
        if (typeof value === "string" && value.trim()) {
          (next as Record<string, string>)[key] = value.trim();
        }
      }
      return next;
    })(),
    sellpoints:
      base.sellpointsLocked && base.sellpoints?.length
        ? base.sellpoints
        : patch.sellpoints?.length
          ? patch.sellpoints
          : base.sellpoints,
    sellpointsLocked: base.sellpointsLocked || Boolean(patch.sellpointsLocked),
    voiceovers: patch.voiceovers?.length ? patch.voiceovers : base.voiceovers,
    selectedVoiceoverId:
      patch.selectedVoiceoverId != null && patch.selectedVoiceoverId !== ""
        ? patch.selectedVoiceoverId
        : (base.selectedVoiceoverId ?? null),
    storyboardVersions: (() => {
      const merged = {
        ...(base.storyboardVersions ?? {}),
        ...(patch.storyboardVersions ?? {}),
      };
      if (
        base.storyboardLocked &&
        base.selectedVersion &&
        base.storyboardVersions?.[base.selectedVersion]?.panels?.length
      ) {
        merged[base.selectedVersion] = base.storyboardVersions[base.selectedVersion]!;
      }
      return merged;
    })(),
    selectedVersion:
      patch.selectedVersion != null
        ? patch.selectedVersion
        : (base.selectedVersion ?? null),
    storyboardLocked: base.storyboardLocked || Boolean(patch.storyboardLocked),
    coverageChecklist: patch.coverageChecklist ?? base.coverageChecklist,
    opsPack:
      base.storyboardLocked || patch.storyboardLocked
        ? patch.opsPack || base.opsPack
          ? (coerceOpsPack({ ...(base.opsPack ?? {}), ...(patch.opsPack ?? {}) }) as FashionDeliverable["opsPack"])
          : base.opsPack
        : base.opsPack,
    outputMode:
      base.storyboardLocked || patch.storyboardLocked
        ? (patch.outputMode ?? base.outputMode)
        : null,
  };

  const coerced = coerceFashionDeliverable(merged) as FashionDeliverable;
  const result = fashionDeliverableSchema.safeParse(coerced);
  const parsed = result.success ? result.data : coerced;
  return stripPrematureFashionDeliverableFields(sanitizePreLockFashionDeliverable(parsed));
}

function parseFashionVoiceoverPickFromChat(
  chatHistory: StoryboardChatMessage[],
): string | null {
  let voiceoversReady = false;
  let picked: string | null = null;
  for (const msg of chatHistory) {
    if (msg.role === "user") {
      const trimmed = msg.content.trim();
      if (trimmed === "确认卖点清单" || trimmed === "重新生成口播文案") {
        voiceoversReady = false;
        picked = null;
        continue;
      }
      if (voiceoversReady) {
        const m = trimmed.match(/^选择口播\s*(V\d+)/);
        if (m?.[1]) picked = m[1];
      }
      continue;
    }
    if (msg.role === "assistant") {
      const parsed = extractFashionDeliverable(msg.content);
      if ((parsed?.voiceovers?.length ?? 0) > 0) {
        voiceoversReady = true;
      }
    }
  }
  return picked;
}

function parseFashionVersionPickFromChat(
  chatHistory: StoryboardChatMessage[],
): FashionVersionKey | null {
  let picked: FashionVersionKey | null = null;
  for (const msg of chatHistory) {
    if (msg.role !== "user") continue;
    const m = msg.content.trim().match(/^选择分镜\s*([A-E])版/);
    if (m?.[1]) picked = m[1] as FashionVersionKey;
  }
  return picked;
}

/** 合并 meta + 会话 + 定稿标记，供 sheet 同步与成片使用 */
export function resolveFashionDeliverableForProject(project: {
  meta?: Record<string, unknown> | null;
  chatHistory?: StoryboardChatMessage[];
}): FashionDeliverable | null {
  const meta = (project.meta as Record<string, unknown> | null) ?? {};
  const metaDeliverable = readMetaFashionDeliverable(meta.deliverable);
  const markdown =
    typeof meta.deliverableMarkdown === "string" ? meta.deliverableMarkdown : "";

  let merged: FashionDeliverable | null =
    metaDeliverable ?? (markdown ? extractFashionDeliverable(markdown) : null);

  const chatHistory = project.chatHistory ?? [];
  for (const msg of chatHistory) {
    if (msg.role !== "assistant") continue;
    const parsed = extractFashionDeliverable(msg.content);
    if (!parsed) continue;
    merged = merged
      ? mergeFashionDeliverablePatch(merged, parsed, merged.productName)
      : parsed;
  }

  if (!merged) return null;

  const wf = (meta.workflow as Record<string, unknown> | undefined) ?? {};
  const storyboardConfirmed = isStoryboardConfirmAfterLastVersionPick(chatHistory);

  if (metaDeliverable?.sellpoints?.length) {
    if (metaDeliverable.sellpointsLocked || wf.fashionSellpointsEdited === true) {
      merged = {
        ...merged,
        sellpoints: metaDeliverable.sellpoints,
        sellpointsLocked: metaDeliverable.sellpointsLocked || merged.sellpointsLocked,
      };
    }
  }

  const versionKey =
    metaDeliverable?.selectedVersion ??
    parseFashionVersionPickFromChat(chatHistory) ??
    merged.selectedVersion ??
    null;

  const voiceoverId =
    parseFashionVoiceoverPickFromChat(chatHistory) ??
    ((merged.voiceovers?.length ?? 0) > 0 ? merged.selectedVoiceoverId : null) ??
    null;
  if (voiceoverId && merged.voiceovers.some((v) => v.id === voiceoverId)) {
    merged = { ...merged, selectedVoiceoverId: voiceoverId };
  } else {
    merged = { ...merged, selectedVoiceoverId: null };
  }

  if (versionKey) {
    const metaVersion = metaDeliverable?.storyboardVersions?.[versionKey];
    const mergedVersion = merged.storyboardVersions?.[versionKey];
    let panels =
      Boolean(metaVersion?.panels?.length) &&
      (metaDeliverable?.selectedVersion === versionKey ||
        storyboardConfirmed ||
        wf.fashionStoryboardPanelsEdited === true)
        ? metaVersion!.panels
        : mergedVersion?.panels?.length
          ? mergedVersion.panels
          : metaVersion?.panels;

    if (!panels?.length) {
      for (let i = chatHistory.length - 1; i >= 0; i--) {
        const msg = chatHistory[i];
        if (msg?.role !== "assistant") continue;
        const parsed = extractFashionDeliverable(msg.content);
        const chatPanels = parsed?.storyboardVersions?.[versionKey]?.panels;
        if (chatPanels?.length) {
          panels = chatPanels;
          break;
        }
      }
    }

    if (panels?.length) {
      merged = {
        ...merged,
        selectedVersion: versionKey,
        storyboardLocked: storyboardConfirmed,
        storyboardVersions: {
          ...(merged.storyboardVersions ?? {}),
          [versionKey]: {
            ...(mergedVersion ?? metaVersion ?? { id: versionKey, title: `${versionKey}版` }),
            panels,
          },
        },
      };
    } else {
      merged = { ...merged, selectedVersion: versionKey };
    }
  }

  if (storyboardConfirmed) {
    merged = { ...merged, storyboardLocked: true };
  } else {
    merged = {
      ...merged,
      storyboardLocked: false,
      opsPack: undefined,
      outputMode: null,
    };
  }

  if (
    storyboardConfirmed &&
    metaDeliverable &&
    hasMeaningfulOpsPack(metaDeliverable)
  ) {
    merged = { ...merged, opsPack: metaDeliverable!.opsPack };
  }
  if (hasFashionOutputModeChoiceInChat(chatHistory) && metaDeliverable?.outputMode) {
    merged = { ...merged, outputMode: metaDeliverable.outputMode };
  }

  return stripPrematureFashionDeliverableFields(merged);
}

export function fashionVersionToSheet(
  deliverable: FashionDeliverable,
  versionKey?: FashionVersionKey,
): StoryboardSheet | null {
  const key = versionKey ?? deliverable.selectedVersion;
  if (!key) return null;
  const version = deliverable.storyboardVersions?.[key];
  if (!version?.panels?.length) return null;

  const sellpoints = deliverable.sellpoints ?? [];
  const sellpointMap = new Map(sellpoints.map((sp) => [sp.id, sp.text]));
  const highlight = sellpoints
    .filter((sp) => sp.layer === "core")
    .map((sp) => sp.text)
    .join("；");

  const voiceovers = deliverable.voiceovers ?? [];
  const sheet = {
    overview: {
      title: version.title || `服装分镜 ${key} 版`,
      logline:
        version.summary?.trim() ||
        voiceovers.find((v) => v.id === deliverable.selectedVoiceoverId)?.narrative ||
        deliverable.productName,
      productHighlight: highlight || undefined,
    },
    cast: [],
    panels: version.panels.map((p, idx) => {
      const index = typeof p.index === "number" ? p.index : idx + 1;
      const scene = p.sceneDesc?.trim() || "—";
      const action = p.modelAction?.trim() || scene;
      return {
        index,
        timeline: undefined,
        shotType: p.shotScale?.trim() || "中景",
        scene,
        action,
        dialogue: p.dialogue?.trim() || undefined,
        camera: p.cameraMove?.trim() || "固定",
        durationHintSec: p.durationSec > 0 ? p.durationSec : 4,
        sellpointTags: p.sellpointIds ?? [],
        imagePrompt:
          p.imagePrompt?.trim() ||
          "竖版9:16，写实UGC摄影，服装展示，禁止画面文字。",
        productInteraction: "wear" as const,
        productVisibility: "hero" as const,
        productBeat: p.garmentFocus?.trim() || "服装展示",
        emotion: p.toneTexture?.trim() || undefined,
      };
    }),
    totalDurationHintSec:
      version.totalDurationSec ??
      version.panels.reduce((sum, p) => sum + (p.durationSec > 0 ? p.durationSec : 4), 0),
  };

  void sellpointMap;
  try {
    return parseStoryboardSheet(sheet);
  } catch {
    return null;
  }
}

export function isFashionWorkflow(meta: Record<string, unknown> | null | undefined): boolean {
  const wf = meta?.workflow as { vertical?: string } | undefined;
  return wf?.vertical === "fashion_apparel";
}
