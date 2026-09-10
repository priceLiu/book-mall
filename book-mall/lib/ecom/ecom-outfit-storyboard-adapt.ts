import { z } from "zod";

import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import {
  buildOutfitStoryboardAdaptUserMessage,
  normalizeOutfitUserSellPointForLlm,
  OUTFIT_CLOTH_VISION_SYSTEM_PROMPT,
  OUTFIT_STORYBOARD_ADAPT_SYSTEM_PROMPT,
} from "@/lib/ecom/ecom-outfit-storyboard-adapt-prompts";
import { ECOM_OUTFIT_VIDEO_TOOL_KEY } from "@/lib/ecom/ecom-outfit-video-types";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { collectEcomGwChatStreamText } from "@/lib/gateway/ecom-gw-chat-stream-collect";
import type { OutfitStoryboardAdapt, SceneShot } from "@/lib/ecom/video-workflow/shot-spine";

const outfitStoryboardAdaptLlmSchema = z
  .object({
    original_storyboard: z.string().optional(),
    originalStoryboard: z.string().optional(),
    cloth_analyse: z.string().optional(),
    clothAnalyse: z.string().optional(),
    user_sell_point: z.string().optional(),
    userSellPoint: z.string().optional(),
    mode: z.string().optional(),
    adjust_logic: z.string().optional(),
    adjustLogic: z.string().optional(),
    final_storyboard: z.string().optional(),
    finalStoryboard: z.string().optional(),
    positive_prompt: z.string().optional(),
    positivePrompt: z.string().optional(),
    negative_prompt: z.string().optional(),
    negativePrompt: z.string().optional(),
  })
  .transform((row) => ({
    originalStoryboard: (row.original_storyboard ?? row.originalStoryboard ?? "").trim(),
    clothAnalyse: (row.cloth_analyse ?? row.clothAnalyse ?? "").trim(),
    userSellPoint: (row.user_sell_point ?? row.userSellPoint ?? "").trim(),
    mode: (row.mode ?? "").trim(),
    adjustLogic: (row.adjust_logic ?? row.adjustLogic ?? "").trim(),
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

export function extractOutfitStoryboardAdaptJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = tryParseJson(fenced[1].trim());
    if (parsed) return parsed;
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return tryParseJson(text.slice(start, end + 1));
}

export function parseOutfitStoryboardAdaptLlmOutput(
  text: string,
): { ok: true; data: ParsedOutfitStoryboardAdapt } | { ok: false; reason: string } {
  const raw = extractOutfitStoryboardAdaptJson(text);
  if (!raw) return { ok: false, reason: "未解析到有效 JSON" };
  const parsed = outfitStoryboardAdaptLlmSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "JSON 字段不完整或格式错误" };
  }
  if (!parsed.data.finalStoryboard.trim()) {
    return { ok: false, reason: "缺少 final_storyboard" };
  }
  if (!parsed.data.positivePrompt.trim()) {
    return { ok: false, reason: "缺少 positive_prompt" };
  }
  return { ok: true, data: parsed.data };
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
  clothAnalyseText: string;
  userSellPoint?: string | null;
  splitModelKey: string;
}): Promise<ParsedOutfitStoryboardAdapt> {
  const userSellPointForLlm = normalizeOutfitUserSellPointForLlm(opts.userSellPoint);
  const originalStoryboard = buildOutfitOriginalStoryboardText(opts.scene);
  const userMessage = buildOutfitStoryboardAdaptUserMessage({
    originalStoryboard,
    clothAnalyseText: opts.clothAnalyseText.trim(),
    userSellPoint: userSellPointForLlm,
  });

  const raw = await collectEcomGwChatStreamText(opts.userId, {
    modelKey: opts.splitModelKey,
    messages: [
      { role: "system", content: OUTFIT_STORYBOARD_ADAPT_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    clientPage: ecomClientPage(opts.userId, opts.projectId, ECOM_OUTFIT_VIDEO_TOOL_KEY),
  });

  const parsed = parseOutfitStoryboardAdaptLlmOutput(raw);
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.data;
}
