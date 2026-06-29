/**
 * 分镜视频 1.0 · sbv1-image runner（文生图 / 图生图）
 */
import { CanvasProjectError } from "./canvas-project-service";
import {
  runImageEngineNode,
  type RunEngineNodeArgs,
  type RunEngineNodeResult,
} from "./canvas-engine-runner";

function httpsImageUrls(urls: string[]): string[] {
  return urls.filter((u) => typeof u === "string" && /^https?:\/\//.test(u.trim()));
}

type Sbv1ImageQuality = "low" | "standard" | "high";
type Sbv1ImageResolution = "1K" | "2K" | "4K";
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

  if (aspectRatio !== "auto") {
    params.aspect_ratio = aspectRatio;
  } else {
    delete params.aspect_ratio;
  }

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

function resolveAspectForRun(
  aspectRatio: Sbv1ImageAspectRatio | string,
  hasRefs: boolean,
): Record<string, unknown> {
  if (aspectRatio === "auto") {
    return hasRefs ? {} : { aspect_ratio: "1:1" };
  }
  return { aspect_ratio: aspectRatio };
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

  const selfUrl =
    typeof data.ossUrl === "string" && /^https?:\/\//.test(data.ossUrl)
      ? data.ossUrl
      : "";
  const upstreamUrls = httpsImageUrls(args.node.imageInputs ?? []);
  const styleUrl =
    typeof styleRef?.imageUrl === "string" &&
    /^https?:\/\//.test(styleRef.imageUrl)
      ? styleRef.imageUrl
      : "";

  const imageUrls = Array.from(
    new Set(
      [selfUrl, ...upstreamUrls, styleUrl].filter(Boolean),
    ),
  ).slice(0, 8);

  const hasRefs = imageUrls.length > 0;
  const stylePrompt = styleRef?.prompt?.trim() ?? "";
  const promptParts = [stylePrompt, promptRaw, ...upstreamText].filter(Boolean);
  const prompt =
    promptParts.join("\n\n") ||
    (hasRefs ? "根据参考图生成或编辑画面" : "");

  if (!prompt.trim()) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "请填写提示词，或上传/连接参考图",
    );
  }

  const aspectRatio = String(data.aspectRatio ?? "auto");
  let params = buildEngineParams(data);
  params = {
    ...params,
    ...resolveAspectForRun(aspectRatio, hasRefs),
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
