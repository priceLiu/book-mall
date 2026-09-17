/**
 * 分镜视频 1.0 · sbv1-image runner（文生图 / 图生图）
 */
import { CanvasProjectError } from "./canvas-project-service";
import { canvasImageEditRequiresRefs } from "./canvas-image-edit-models";
import {
  runImageEngineNode,
  type RunEngineNodeArgs,
  type RunEngineNodeResult,
} from "./canvas-engine-runner";
import { shouldSkipUpstreamTextForImageRefs } from "./canvas-image-engine-prompt";
import { finalizeStoryPro2SceneImagePrompt } from "./story-pro2-scene-image-prompt";

function httpsImageUrls(urls: string[]): string[] {
  return urls.filter((u) => typeof u === "string" && /^https?:\/\//.test(u.trim()));
}

/** 组装 sbv1 / Pro2 图片节点参考图：显式 dock/上游 refs 优先，勿把节点旧输出与 refs 重复合并。 */
export function resolveSbv1ImageReferenceUrls(input: {
  isHdGridSplit: boolean;
  pendingGridCrop: boolean;
  precroppedUrl: string;
  selfUrl: string;
  upstreamUrls: string[];
  /** prompt 已展开为 图N 时禁止回退节点旧输出，避免「看起来像带了参考图」实则只喂了自己 */
  skipSelfFallback?: boolean;
}): string[] {
  if (input.pendingGridCrop) return [];
  if (input.precroppedUrl) return [input.precroppedUrl];
  if (input.isHdGridSplit) return input.upstreamUrls.slice(0, 8);

  const urls =
    input.upstreamUrls.length > 0
      ? input.upstreamUrls
      : !input.skipSelfFallback && input.selfUrl
        ? [input.selfUrl]
        : [];
  return Array.from(new Set(urls.filter(Boolean))).slice(0, 8);
}

type Sbv1ImageQuality = "low" | "standard" | "high";
type Sbv1ImageResolution = "1K" | "2K" | "4K";
/** 与 canvas-web SBV1_IMAGE_DOCK_DEFAULT_ASPECT · Dock 默认展示一致 */
const SBV1_IMAGE_DOCK_DEFAULT_ASPECT = "16:9";

type Sbv1ImageAspectRatio =
  | "auto"
  | "1:1"
  | "1:2"
  | "2:1"
  | "9:16"
  | "16:9"
  | "3:4"
  | "4:3"
  | "3:2"
  | "2:3"
  | "5:4"
  | "4:5"
  | "21:9"
  | "9:21";

function buildEngineParams(data: Record<string, unknown>): Record<string, unknown> {
  const engine = (data.engine as Record<string, unknown> | undefined) ?? {};
  const fromEngine = (engine.params as Record<string, unknown> | undefined) ?? {};
  const aspectRatio = String(data.aspectRatio ?? fromEngine.aspect_ratio ?? "auto");
  const resolution = String(data.resolution ?? fromEngine.resolution ?? "2K");
  const quality = String(data.imageQuality ?? "standard") as Sbv1ImageQuality;
  const outputCount = Number(data.outputCount ?? fromEngine.n ?? 1);

  const params: Record<string, unknown> = {
    ...fromEngine,
    resolution:
      resolution === "4K" ? "4K" : resolution === "1K" ? "1K" : "2K",
    output_format: fromEngine.output_format ?? "png",
  };

  params.aspect_ratio =
    aspectRatio !== "auto" ? aspectRatio : SBV1_IMAGE_DOCK_DEFAULT_ASPECT;

  if (quality === "high") {
    params.quality = "high";
  } else if (quality === "low") {
    params.quality = "medium";
  } else {
    delete params.quality;
  }

  const n = Math.min(4, Math.max(1, Math.round(outputCount) || 1));
  if (n > 1) params.n = n;
  else delete params.n;

  return params;
}

/** 写入 Gateway createTask · auto 与 Dock 默认一致（图生图不再省略比例） */
export function resolveSbv1ImageAspectForGatewayRun(
  aspectRatio: Sbv1ImageAspectRatio | string,
): string {
  const raw = String(aspectRatio ?? "auto").trim();
  return raw && raw !== "auto" ? raw : SBV1_IMAGE_DOCK_DEFAULT_ASPECT;
}

function resolveAspectForRun(
  aspectRatio: Sbv1ImageAspectRatio | string,
): Record<string, unknown> {
  return { aspect_ratio: resolveSbv1ImageAspectForGatewayRun(aspectRatio) };
}

export async function runSbv1ImageNode(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const data = args.node.data ?? {};
  const engine = (data.engine as Record<string, unknown> | undefined) ?? {};
  const providerId = String(engine.providerId ?? data.providerId ?? "");
  const modelKey = String(engine.modelKey ?? data.modelKey ?? "");
  const promptRaw = String(data.dockInput ?? "").trim();
  const upstreamText = (args.node.textInputs ?? []).filter((s) => s && s.trim());

  const styleRef = data.dockStyleRef as
    | { prompt?: string; imageUrl?: string; name?: string }
    | undefined;

  if (!providerId || !modelKey) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "sbv1-image 缺少生图模型配置",
    );
  }

  const isHdGridSplit = Boolean(data.pro2HdFromGridSplit);
  const pendingGridCrop = Boolean(
    isHdGridSplit &&
      data.gridSplitCrop &&
      typeof data.gridSplitCrop === "object" &&
      data.gridSplitFrameCrop !== true,
  );
  const selfUrl =
    !isHdGridSplit &&
    typeof data.ossUrl === "string" &&
    /^https?:\/\//.test(data.ossUrl)
      ? data.ossUrl
      : "";
  const upstreamUrls = httpsImageUrls(args.node.imageInputs ?? []);
  const precroppedUrl =
    isHdGridSplit &&
    data.gridSplitFrameCrop === true &&
    typeof data.ossUrl === "string" &&
    /^https?:\/\//.test(data.ossUrl)
      ? data.ossUrl
      : "";
  const imageUrls = resolveSbv1ImageReferenceUrls({
    isHdGridSplit,
    pendingGridCrop,
    precroppedUrl,
    selfUrl,
    upstreamUrls,
    skipSelfFallback: /(?:图\s*\d+|\[Image\s+\d+\])/i.test(promptRaw),
  });

  const hasRefs = imageUrls.length > 0;
  const stylePrompt = styleRef?.prompt?.trim() ?? "";
  const skipUpstream = shouldSkipUpstreamTextForImageRefs(promptRaw, hasRefs);
  const promptParts = [
    stylePrompt,
    promptRaw,
    ...(skipUpstream ? [] : upstreamText),
  ].filter(Boolean);
  let prompt =
    promptParts.join("\n\n") ||
    (hasRefs ? "根据参考图生成或编辑画面" : "");

  if (String(data.pro2MediaRole ?? "") === "scene") {
    prompt = finalizeStoryPro2SceneImagePrompt(prompt);
  }

  if (!prompt.trim()) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "请填写提示词，或上传/连接参考图",
    );
  }

  if (canvasImageEditRequiresRefs(modelKey, { imageMode: String(data.imageMode ?? "") }) && !hasRefs) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "图像编辑模型须至少一张参考图（连接上游图片或上传）",
    );
  }

  const aspectRatio = String(data.aspectRatio ?? "auto");
  let params = buildEngineParams(data);
  params = {
    ...params,
    ...resolveAspectForRun(aspectRatio),
  };

  return runImageEngineNode({
    ...args,
    clientPage: args.clientPage ?? `canvas/${args.projectId}/sbv1`,
    node: {
      ...args.node,
      type: "image-engine",
      modelKey,
      data: {
        providerId,
        modelKey,
        prompt,
        params,
        sbv1Billing: {
          edition: "sbv1",
          aspectRatio,
          imageQuality: data.imageQuality ?? "standard",
          resolution: data.resolution ?? "2K",
          outputCount: data.outputCount ?? 1,
          imageInputCount: imageUrls.length,
          hasSelfImage: Boolean(selfUrl),
          modelKey,
          providerId,
        },
      },
      imageInputs: imageUrls,
      textInputs: [],
    },
  });
}
