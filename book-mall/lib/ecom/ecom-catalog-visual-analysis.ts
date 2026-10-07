import { canvasGwChatWithOverloadRetry } from "@/lib/canvas/canvas-gateway-client";
import { GATEWAY_BAILIAN_PROVIDER_ID } from "@/lib/canvas/canvas-gateway-providers";
import { shouldCanvasUseGateway } from "@/lib/canvas/canvas-gateway-run";
import { CanvasProjectError } from "@/lib/canvas/canvas-project-service";
import type { CanvasChatMessage } from "@/lib/canvas/providers/types";
import {
  buildCatalogSceneVisionUserText,
  buildCatalogStyleVisionUserText,
  CATALOG_SCENE_VISION_SYSTEM,
  CATALOG_STYLE_VISION_SYSTEM,
} from "@/lib/ecom/ecom-catalog-style-scene-prompts";
import { resolveCatalogVisionModelKey } from "@/lib/ecom/ecom-catalog-vision-model";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";

function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("视觉分析未返回有效 JSON");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

function visionUserMessage(imageUrl: string, userText: string): CanvasChatMessage {
  return {
    role: "user",
    content: [
      { type: "image_url", image_url: { url: imageUrl.trim() } },
      { type: "text", text: userText },
    ],
  };
}

export type CatalogVisionAnalysisOpts = {
  userId: string;
  imageUrl: string;
  /** 画布 Gateway 视觉 modelKey（与图片反推默认一致，prompt 为 catalog 专用） */
  modelKey?: string;
  projectId?: string | null;
  sourceModule?: string;
};

async function assertCatalogVisionGatewayAccess(
  opts: CatalogVisionAnalysisOpts,
  modelKey: string,
): Promise<void> {
  if (opts.sourceModule === "canvas") {
    await shouldCanvasUseGateway(opts.userId, GATEWAY_BAILIAN_PROVIDER_ID, modelKey);
    return;
  }
  await assertEcomToolkitGatewayAccess(opts.userId);
}

async function runCatalogVisionChat(
  opts: CatalogVisionAnalysisOpts & {
    systemPrompt: string;
    userText: string;
    clientPageSuffix: "style" | "scene";
  },
): Promise<{ text: string; modelKey: string }> {
  const modelKey = resolveCatalogVisionModelKey(opts.modelKey);
  await assertCatalogVisionGatewayAccess(opts, modelKey);

  const projectId = opts.projectId?.trim() || undefined;
  const clientPage =
    opts.sourceModule === "canvas" && projectId
      ? `canvas/${projectId}/catalog-import/${opts.clientPageSuffix}`
      : `ecom/catalog-import/${opts.clientPageSuffix}`;

  try {
    const { text } = await canvasGwChatWithOverloadRetry(opts.userId, {
      modelKey,
      messages: [
        { role: "system", content: opts.systemPrompt },
        visionUserMessage(opts.imageUrl, opts.userText),
      ],
      clientPage,
      projectId,
    });
    return { text, modelKey };
  } catch (e) {
    if (e instanceof CanvasProjectError) {
      throw new Error(e.message);
    }
    throw e;
  }
}

export type StyleCatalogVisionResult = {
  stylePrompt: string;
  tags: Record<string, unknown>;
};

export type SceneCatalogVisionResult = {
  visualPrompt: string;
  tags: Record<string, unknown>;
};

export async function analyzeStyleImageForCatalog(
  opts: CatalogVisionAnalysisOpts,
): Promise<StyleCatalogVisionResult> {
  const { text, modelKey } = await runCatalogVisionChat({
    ...opts,
    systemPrompt: CATALOG_STYLE_VISION_SYSTEM,
    userText: buildCatalogStyleVisionUserText(),
    clientPageSuffix: "style",
  });

  const parsed = extractJsonObject(text);
  const positiveEn = typeof parsed.positiveEn === "string" ? parsed.positiveEn.trim() : "";
  const negativeEn = typeof parsed.negativeEn === "string" ? parsed.negativeEn.trim() : "";
  const analysisZh = typeof parsed.analysisZh === "string" ? parsed.analysisZh.trim() : "";
  const shortTagsZh = Array.isArray(parsed.shortTagsZh)
    ? parsed.shortTagsZh
        .filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
        .map((t) => t.trim())
    : [];
  if (!positiveEn) throw new Error("风格分析缺少 positiveEn");

  const stylePrompt = [positiveEn, analysisZh ? `\n${analysisZh}` : ""].join("").trim();
  return {
    stylePrompt,
    tags: {
      positiveEn,
      negativeEn: negativeEn || undefined,
      analysisZh: analysisZh || undefined,
      shortTagsZh,
      analyzedAt: new Date().toISOString(),
      modelKey,
      promptKind: "catalog-style",
    },
  };
}

export async function analyzeSceneImageForCatalog(
  opts: CatalogVisionAnalysisOpts,
): Promise<SceneCatalogVisionResult> {
  const { text, modelKey } = await runCatalogVisionChat({
    ...opts,
    systemPrompt: CATALOG_SCENE_VISION_SYSTEM,
    userText: buildCatalogSceneVisionUserText(),
    clientPageSuffix: "scene",
  });

  const parsed = extractJsonObject(text);
  const sceneBodyZh = typeof parsed.sceneBodyZh === "string" ? parsed.sceneBodyZh.trim() : "";
  const positiveEn = typeof parsed.positiveEn === "string" ? parsed.positiveEn.trim() : "";
  const negativeEn = typeof parsed.negativeEn === "string" ? parsed.negativeEn.trim() : "";
  const deepAnalysisZh =
    typeof parsed.deepAnalysisZh === "string" ? parsed.deepAnalysisZh.trim() : "";
  const shortTagsZh = Array.isArray(parsed.shortTagsZh)
    ? parsed.shortTagsZh
        .filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
        .map((t) => t.trim())
    : [];
  const visualPrompt = positiveEn || sceneBodyZh;
  if (!visualPrompt) throw new Error("场景分析缺少 visualPrompt");

  return {
    visualPrompt,
    tags: {
      sceneBodyZh: sceneBodyZh || undefined,
      positiveEn: positiveEn || undefined,
      negativeEn: negativeEn || undefined,
      deepAnalysisZh: deepAnalysisZh || undefined,
      shortTagsZh,
      analyzedAt: new Date().toISOString(),
      modelKey,
      promptKind: "catalog-scene",
    },
  };
}
