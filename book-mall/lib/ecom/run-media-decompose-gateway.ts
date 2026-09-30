/**
 * 拆图拆视频 · Gateway 拆解（电商 / 画布反推共用）
 */
import type { CanvasChatContentPart, CanvasChatMessage } from "@/lib/canvas/providers/types";
import {
  assertStoryLlmVideoUnderstandingModel,
  assertStoryLlmVisionModel,
  isStoryLlmVideoUnderstandingModel,
  isStoryLlmVisionModel,
  STORY_LLM_DEFAULT_VISION_MODEL,
} from "@/lib/canvas/story-llm-vision-models";
import {
  applyMediaDecomposeAsrOverlay,
  formatMediaDecomposeAsrPromptBlock,
  MEDIA_DECOMPOSE_NO_SPEECH,
  transcribeMediaDecomposeVideo,
  type MediaDecomposeAsrBundle,
} from "@/lib/ecom/ecom-media-decompose-asr";
import {
  appendMediaDecomposeAsrTranscriptBlock,
  appendMediaDecomposeJsonDeliveryFooter,
  buildMediaDecomposeSystemPrompt,
  DEFAULT_IMAGE_DECOMPOSE_USER_PROMPT,
  DEFAULT_VIDEO_DECOMPOSE_USER_PROMPT,
} from "@/lib/ecom/ecom-media-decompose-prompts";
import {
  extractMediaDecomposePatch,
  resolveMediaDecomposeParseError,
  toMediaDecomposeFence,
  type MediaDecomposePatch,
} from "@/lib/ecom/ecom-media-decompose-structured";
import { ECOM_MEDIA_DECOMPOSE_DEFAULT_CHAT_MODEL } from "@/lib/ecom/ecom-media-decompose-types";
import { ecomGwChatStream } from "@/lib/gateway/ecom-tool-gateway-client";
import { readEcomGwChatSseStream } from "@/lib/gateway/ecom-gw-chat-sse-read";

export type MediaDecomposeGatewayMedia = {
  kind: "image" | "video";
  ossUrl: string;
};

export type MediaDecomposeGatewayStreamHandlers = {
  onAsrStatus?: (message: string) => void;
  onThinking?: () => void;
  onContent?: (piece: string) => void;
};

export type RunMediaDecomposeGatewayResult = {
  /** 选项 A：优先 canonical fence，否则模型原文 */
  rawText: string;
  fullText: string;
  structured: MediaDecomposePatch | null;
  parseError: string | null;
  gatewayLogId: string | null;
};

export function buildMediaDecomposeGwUserContent(
  prompt: string,
  media: MediaDecomposeGatewayMedia,
): string | CanvasChatContentPart[] {
  const parts: CanvasChatContentPart[] = [];
  if (media.kind === "video") {
    parts.push({ type: "video_url", video_url: { url: media.ossUrl } });
  } else {
    parts.push({ type: "image_url", image_url: { url: media.ossUrl } });
  }
  parts.push({ type: "text", text: prompt });
  return parts;
}

export function resolveMediaDecomposeDefaultUserPrompt(
  kind: "image" | "video",
  override?: string,
): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;
  return kind === "video"
    ? DEFAULT_VIDEO_DECOMPOSE_USER_PROMPT
    : DEFAULT_IMAGE_DECOMPOSE_USER_PROMPT;
}

export function resolveMediaDecomposeChatModelKey(
  modelKey: string | undefined,
  mediaKind: "image" | "video",
): string {
  let key =
    modelKey?.trim() ||
    ECOM_MEDIA_DECOMPOSE_DEFAULT_CHAT_MODEL ||
    STORY_LLM_DEFAULT_VISION_MODEL;
  if (!isStoryLlmVisionModel(key)) {
    key = STORY_LLM_DEFAULT_VISION_MODEL;
  }
  if (mediaKind === "video" && !isStoryLlmVideoUnderstandingModel(key)) {
    key = STORY_LLM_DEFAULT_VISION_MODEL;
  }
  if (mediaKind === "video") {
    assertStoryLlmVideoUnderstandingModel(key, "拆图拆视频");
  } else {
    assertStoryLlmVisionModel(key, "拆图拆视频");
  }
  return key;
}

export async function runMediaDecomposeGateway(opts: {
  userId: string;
  media: MediaDecomposeGatewayMedia;
  modelKey?: string;
  userPrompt?: string;
  clientPage: string;
  signal?: AbortSignal;
  handlers?: MediaDecomposeGatewayStreamHandlers;
}): Promise<RunMediaDecomposeGatewayResult> {
  const modelKey = resolveMediaDecomposeChatModelKey(opts.modelKey, opts.media.kind);
  const baseUserPrompt = resolveMediaDecomposeDefaultUserPrompt(
    opts.media.kind,
    opts.userPrompt,
  );
  const systemPrompt = buildMediaDecomposeSystemPrompt({
    mediaKind: opts.media.kind,
  });

  let asrBundle: MediaDecomposeAsrBundle | null = null;
  if (opts.media.kind === "video") {
    opts.handlers?.onAsrStatus?.("正在识别口播（ASR）…");
    asrBundle = await transcribeMediaDecomposeVideo({
      userId: opts.userId,
      fileUrl: opts.media.ossUrl,
      clientPage: opts.clientPage,
    });
    const asrNote = asrBundle.failed
      ? `口播识别未完成（${asrBundle.failMessage ?? "未知错误"}），继续画面拆解。`
      : asrBundle.fullTranscript === MEDIA_DECOMPOSE_NO_SPEECH
        ? "未检出人声，继续画面拆解。"
        : "口播识别完成，开始画面拆解…";
    opts.handlers?.onAsrStatus?.(asrNote);
  }

  const gatewayUserPrompt = appendMediaDecomposeJsonDeliveryFooter(
    asrBundle
      ? appendMediaDecomposeAsrTranscriptBlock(
          baseUserPrompt,
          formatMediaDecomposeAsrPromptBlock(asrBundle),
        )
      : baseUserPrompt,
  );

  const messages: CanvasChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: buildMediaDecomposeGwUserContent(gatewayUserPrompt, opts.media),
    },
  ];

  const gw = await ecomGwChatStream(opts.userId, {
    modelKey,
    messages,
    clientPage: opts.clientPage,
  });

  let thinkingSent = false;
  const fullText = await readEcomGwChatSseStream(gw.body, {
    signal: opts.signal,
    handlers: {
      onThinkingProgress: () => {
        if (thinkingSent) return;
        thinkingSent = true;
        opts.handlers?.onThinking?.();
      },
      onContent: (piece) => {
        opts.handlers?.onContent?.(piece);
      },
    },
  });

  const extracted = extractMediaDecomposePatch(fullText);
  const structured =
    extracted && asrBundle
      ? applyMediaDecomposeAsrOverlay(extracted, asrBundle)
      : extracted;
  const parseError = structured ? null : resolveMediaDecomposeParseError(fullText);
  const rawText = structured
    ? toMediaDecomposeFence(structured)
    : fullText.trim();

  return {
    rawText,
    fullText: fullText.trim(),
    structured: structured ?? null,
    parseError,
    gatewayLogId: gw.logId ?? null,
  };
}
