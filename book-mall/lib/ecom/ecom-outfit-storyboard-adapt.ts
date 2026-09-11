import { z } from "zod";

import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import {
  buildOutfitModelSceneBrief,
  buildOutfitStoryboardAdaptUserMessage,
  normalizeOutfitUserSellPointForLlm,
  buildOutfitStoryboardAdaptSystemPrompt,
  OUTFIT_CLOTH_VISION_SYSTEM_PROMPT,
  OUTFIT_PRODUCTION_FENCE,
} from "@/lib/ecom/ecom-outfit-storyboard-adapt-prompts";
import { normalizeOutfitProductionMentionFields } from "@/lib/ecom/ecom-outfit-production-mentions";
import { ECOM_OUTFIT_VIDEO_TOOL_KEY } from "@/lib/ecom/ecom-outfit-video-types";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { collectEcomGwChatStreamText } from "@/lib/gateway/ecom-gw-chat-stream-collect";
import type {
  OutfitStoryboardAdapt,
  SceneShot,
  WorkflowRefs,
} from "@/lib/ecom/video-workflow/shot-spine";

/** LLM 常返回 null / 数字 / 嵌套对象，统一 coerce 为字符串再校验 */
const optionalLlmString = z.preprocess((val) => {
  if (val == null) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) {
    return val
      .map((item) => (item == null ? "" : typeof item === "string" ? item.trim() : String(item)))
      .filter(Boolean)
      .join(" ");
  }
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return "";
    }
  }
  return String(val);
}, z.string());

const outfitStoryboardAdaptLlmSchema = z
  .object({
    original_storyboard: optionalLlmString.optional(),
    originalStoryboard: optionalLlmString.optional(),
    cloth_analyse: optionalLlmString.optional(),
    clothAnalyse: optionalLlmString.optional(),
    user_sell_point: optionalLlmString.optional(),
    userSellPoint: optionalLlmString.optional(),
    mode: optionalLlmString.optional(),
    adjust_logic: optionalLlmString.optional(),
    adjustLogic: optionalLlmString.optional(),
    camera_move: optionalLlmString.optional(),
    cameraMove: optionalLlmString.optional(),
    character_action: optionalLlmString.optional(),
    characterAction: optionalLlmString.optional(),
    lighting_setup: optionalLlmString.optional(),
    lightingSetup: optionalLlmString.optional(),
    scene_background: optionalLlmString.optional(),
    sceneBackground: optionalLlmString.optional(),
    final_storyboard: optionalLlmString.optional(),
    finalStoryboard: optionalLlmString.optional(),
    positive_prompt: optionalLlmString.optional(),
    positivePrompt: optionalLlmString.optional(),
    negative_prompt: optionalLlmString.optional(),
    negativePrompt: optionalLlmString.optional(),
  })
  .passthrough()
  .transform((row) => ({
    originalStoryboard: (row.original_storyboard ?? row.originalStoryboard ?? "").trim(),
    clothAnalyse: (row.cloth_analyse ?? row.clothAnalyse ?? "").trim(),
    userSellPoint: (row.user_sell_point ?? row.userSellPoint ?? "").trim(),
    mode: (row.mode ?? "").trim(),
    adjustLogic: (row.adjust_logic ?? row.adjustLogic ?? "").trim(),
    cameraMove: (row.camera_move ?? row.cameraMove ?? "").trim(),
    characterAction: (row.character_action ?? row.characterAction ?? "").trim(),
    lightingSetup: (row.lighting_setup ?? row.lightingSetup ?? "").trim(),
    sceneBackground: (row.scene_background ?? row.sceneBackground ?? "").trim(),
    finalStoryboard: (row.final_storyboard ?? row.finalStoryboard ?? "").trim(),
    positivePrompt: (row.positive_prompt ?? row.positivePrompt ?? "").trim(),
    negativePrompt: (row.negative_prompt ?? row.negativePrompt ?? "").trim(),
  }));

export type ParsedOutfitStoryboardAdapt = z.infer<typeof outfitStoryboardAdaptLlmSchema>;

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** LLM 常见脏 JSON：尾逗号、中文弯引号 */
function repairOutfitStoryboardAdaptJsonText(text: string): string {
  return text
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");
}

function tryParseJsonWithRepair(text: string): unknown | null {
  const direct = tryParseJson(text);
  if (direct) return direct;
  return tryParseJson(repairOutfitStoryboardAdaptJsonText(text));
}

function unwrapOutfitStoryboardAdaptJsonRoot(raw: unknown): unknown | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const firstObject = raw.find((item) => item && typeof item === "object" && !Array.isArray(item));
    return firstObject ?? null;
  }
  if (typeof raw === "object") return raw;
  return null;
}

export function extractOutfitStoryboardAdaptJson(text: string): unknown | null {
  const dedicatedClosed = text.match(
    new RegExp(`\`\`\`${OUTFIT_PRODUCTION_FENCE}\\s*([\\s\\S]*?)\`\`\``, "i"),
  );
  if (dedicatedClosed?.[1]) {
    const parsed = unwrapOutfitStoryboardAdaptJsonRoot(
      tryParseJsonWithRepair(dedicatedClosed[1].trim()),
    );
    if (parsed) return parsed;
  }
  const dedicatedOpen = text.match(
    new RegExp(`\`\`\`${OUTFIT_PRODUCTION_FENCE}\\s*([\\s\\S]*)$`, "i"),
  );
  if (dedicatedOpen?.[1]) {
    const parsed = unwrapOutfitStoryboardAdaptJsonRoot(
      tryParseJsonWithRepair(dedicatedOpen[1].trim()),
    );
    if (parsed) return parsed;
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = unwrapOutfitStoryboardAdaptJsonRoot(tryParseJsonWithRepair(fenced[1].trim()));
    if (parsed) return parsed;
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    const arrayStart = text.indexOf("[");
    const arrayEnd = text.lastIndexOf("]");
    if (arrayStart < 0 || arrayEnd <= arrayStart) return null;
    return unwrapOutfitStoryboardAdaptJsonRoot(
      tryParseJsonWithRepair(text.slice(arrayStart, arrayEnd + 1)),
    );
  }
  return unwrapOutfitStoryboardAdaptJsonRoot(tryParseJsonWithRepair(text.slice(start, end + 1)));
}

export function parseOutfitStoryboardAdaptLlmOutput(
  text: string,
): { ok: true; data: ParsedOutfitStoryboardAdapt } | { ok: false; reason: string } {
  const raw = extractOutfitStoryboardAdaptJson(text);
  if (!raw) {
    return {
      ok: false,
      reason: `未解析到 \`${OUTFIT_PRODUCTION_FENCE}\` 围栏内的有效 JSON`,
    };
  }
  const parsed = outfitStoryboardAdaptLlmSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 2)
      .map((issue) => issue.path.join(".") || "root")
      .join(", ");
    return {
      ok: false,
      reason: detail
        ? `JSON 字段不完整或格式错误（${detail}）`
        : "JSON 字段不完整或格式错误",
    };
  }
  if (!parsed.data.finalStoryboard.trim()) {
    return { ok: false, reason: "缺少 final_storyboard" };
  }
  if (!parsed.data.positivePrompt.trim()) {
    return { ok: false, reason: "缺少 positive_prompt" };
  }
  const data = { ...parsed.data };
  if (!data.characterAction.trim() && data.finalStoryboard.trim()) {
    data.characterAction = data.finalStoryboard;
  }
  if (!data.characterAction.trim()) {
    return { ok: false, reason: "缺少 character_action" };
  }
  const normalized = normalizeOutfitProductionMentionFields(data);
  return { ok: true, data: normalized };
}

/** 将单镜 enrich 字段拼成拉片原文，供 LLM 读取 */
export function buildOutfitOriginalStoryboardText(scene: SceneShot): string {
  const lines = [
    `镜号 ${scene.index} · 时长 ${scene.durationSec}s`,
    scene.cameraType?.trim() ? `机位：${scene.cameraType.trim()}` : null,
    scene.motionType?.trim() ? `运镜类型：${scene.motionType.trim()}` : null,
    scene.cameraMove?.trim() ? `运镜描述：${scene.cameraMove.trim()}` : null,
    scene.characterAction?.trim() ? `模特动作：${scene.characterAction.trim()}` : null,
    scene.lightingSetup?.trim() ? `布光：${scene.lightingSetup.trim()}` : null,
    scene.sceneBackground?.trim() ? `背景：${scene.sceneBackground.trim()}` : null,
    scene.toneContrast?.trim() ? `影调：${scene.toneContrast.trim()}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function toOutfitStoryboardAdaptPatch(
  parsed: ParsedOutfitStoryboardAdapt,
  opts: { splitModelKey: string; userSellPointForLlm: string; status: "success" | "failed"; failReason?: string },
): OutfitStoryboardAdapt {
  if (opts.status === "failed") {
    return {
      status: "failed",
      failReason: opts.failReason ?? "分镜适配失败",
      userSellPoint: opts.userSellPointForLlm,
      splitModelKey: opts.splitModelKey,
      adaptedAt: new Date().toISOString(),
    };
  }
  return {
    status: "success",
    originalStoryboard: parsed.originalStoryboard,
    clothAnalyse: parsed.clothAnalyse,
    userSellPoint: parsed.userSellPoint || opts.userSellPointForLlm,
    mode: parsed.mode,
    adjustLogic: parsed.adjustLogic,
    cameraMove: parsed.cameraMove || undefined,
    characterAction: parsed.characterAction || undefined,
    lightingSetup: parsed.lightingSetup || undefined,
    sceneBackground: parsed.sceneBackground || undefined,
    finalStoryboard: parsed.finalStoryboard,
    positivePrompt: parsed.positivePrompt,
    negativePrompt: parsed.negativePrompt || undefined,
    adaptedAt: new Date().toISOString(),
    splitModelKey: opts.splitModelKey,
  };
}

export async function analyseOutfitClothFromImage(opts: {
  userId: string;
  projectId: string;
  imageUrl: string;
  modelKey?: string;
}): Promise<{ structuredText: string; modelKey: string }> {
  const modelKey = opts.modelKey?.trim() || ECOM_DEFAULT_VISION_MODEL;
  assertStoryLlmVisionModel(modelKey, "服装识别");

  const userParts: CanvasChatContentPart[] = [
    { type: "image_url", image_url: { url: opts.imageUrl.trim() } },
    {
      type: "text",
      text: "请分析图中模特所穿服装，按系统要求输出 5 类结构化信息与自动推导天然卖点。",
    },
  ];

  const structuredText = (
    await collectEcomGwChatStreamText(opts.userId, {
      modelKey,
      messages: [
        { role: "system", content: OUTFIT_CLOTH_VISION_SYSTEM_PROMPT },
        { role: "user", content: userParts },
      ],
      clientPage: ecomClientPage(opts.userId, opts.projectId, ECOM_OUTFIT_VIDEO_TOOL_KEY),
    })
  ).trim();

  if (!structuredText) throw new Error("服装识别未返回有效内容");
  if (!structuredText.includes("品类：")) {
    throw new Error("服装识别结果格式异常，请重试");
  }

  return { structuredText, modelKey };
}

export async function adaptOutfitSceneStoryboardLlm(opts: {
  userId: string;
  projectId: string;
  scene: SceneShot;
  refs: WorkflowRefs;
  clothAnalyseText: string;
  userSellPoint?: string | null;
  splitModelKey: string;
}): Promise<ParsedOutfitStoryboardAdapt> {
  const userSellPointForLlm = normalizeOutfitUserSellPointForLlm(opts.userSellPoint);
  const referenceSkeleton = buildOutfitOriginalStoryboardText(opts.scene);
  const modelSceneBrief = buildOutfitModelSceneBrief(opts.refs);
  const userMessage = buildOutfitStoryboardAdaptUserMessage({
    referenceSkeleton,
    clothAnalyseText: opts.clothAnalyseText.trim(),
    modelSceneBrief,
    userSellPoint: userSellPointForLlm,
  });

  const maxAttempts = 3;
  let lastReason = "分镜制作策划失败";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const modelKey = opts.splitModelKey.trim();
    const useJsonObjectMode = /qwen|deepseek|glm/i.test(modelKey);
    const raw = await collectEcomGwChatStreamText(opts.userId, {
      modelKey,
      messages: [
        { role: "system", content: buildOutfitStoryboardAdaptSystemPrompt() },
        { role: "user", content: userMessage },
      ],
      params: useJsonObjectMode ? { response_format: { type: "json_object" } } : undefined,
      clientPage: ecomClientPage(opts.userId, opts.projectId, ECOM_OUTFIT_VIDEO_TOOL_KEY),
    });

    const parsed = parseOutfitStoryboardAdaptLlmOutput(raw);
    if (parsed.ok) return parsed.data;

    lastReason = parsed.reason;
    const retryable =
      /JSON|未解析|缺少 final_storyboard|缺少 positive_prompt|缺少 character_action/.test(
        parsed.reason,
      );
    if (!retryable || attempt >= maxAttempts) break;
    await new Promise((r) => setTimeout(r, 400 * attempt));
  }

  throw new Error(lastReason);
}
