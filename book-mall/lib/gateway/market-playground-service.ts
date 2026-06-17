/**
 * Gateway Market Playground · 创建任务 / 轮询 / 历史
 */
import type { GatewayUser } from "@prisma/client";

import { buildKieImageCreateArgs } from "@/lib/canvas/providers/kie";
import { buildKieToolI2vCreateArgs } from "@/lib/canvas/kie-grok-builders";
import { buildKieToolVideoCreateArgs } from "@/lib/canvas/kie-video-tool-builders";
import {
  assertGatewayApiKeyLinkedForUser,
  GatewayRequiredError,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import {
  gatewayV1ChatCompletions,
  gatewayV1CreateTask,
  gatewayV1RecordInfo,
  gatewayV1ClientMeta,
} from "@/lib/gateway/gateway-v1-http-client";
import { normalizeKieRecordForToolLab } from "@/lib/gateway/kie-tool-gateway";
import { buildGatewayLogWhere, resolveGatewaySessionBookUserId } from "@/lib/gateway/log-query-scope";
import { getPlaygroundSchema } from "@/lib/gateway/market-playground-schemas";
import { getMarketModelDetail } from "@/lib/gateway/market-catalog";
import {
  extractKieResultUrl,
  type KieRecordResponse,
} from "@/lib/story/kie-client";
import { prisma } from "@/lib/prisma";

const CLIENT_SOURCE = "GATEWAY_CONSOLE" as const;

function marketClientPage(canonicalKey: string): string {
  return `market-playground/${canonicalKey}`;
}

function asStringArray(v: unknown): string[] {
  if (typeof v === "string" && v.trim()) return [v.trim()];
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }
  return [];
}

function buildCreateTaskBody(
  canonicalKey: string,
  activeModelKey: string,
  input: Record<string, unknown>,
): { model: string; input: Record<string, unknown> } {
  const schema = getPlaygroundSchema(canonicalKey, "IMAGE");

  if (schema.mode === "chat") {
    throw new Error("chat 模型请走 chat 接口");
  }

  const model = activeModelKey.trim();

  if (
    model === "grok-imagine/image-to-video" ||
    model === "grok-imagine-video-1-5-preview"
  ) {
    return buildKieToolI2vCreateArgs({
      model,
      prompt: String(input.prompt ?? ""),
      imageUrls: asStringArray(input.image_urls ?? input.imageUrls),
      resolution: typeof input.resolution === "string" ? input.resolution : undefined,
      duration:
        typeof input.duration === "number"
          ? input.duration
          : typeof input.duration === "string"
            ? parseInt(input.duration, 10)
            : undefined,
      mode: typeof input.mode === "string" ? input.mode : undefined,
      aspectRatio: typeof input.aspect_ratio === "string" ? input.aspect_ratio : undefined,
    });
  }

  if (
    model === "wan/2-6-video-to-video" ||
    model.includes("motion-control") ||
    model === "topaz/video-upscale"
  ) {
    return buildKieToolVideoCreateArgs({
      model,
      prompt: typeof input.prompt === "string" ? input.prompt : undefined,
      imageUrls: asStringArray(input.input_urls ?? input.image_urls),
      videoUrls: asStringArray(input.video_urls),
      videoUrl: typeof input.video_url === "string" ? input.video_url : undefined,
      resolution: typeof input.resolution === "string" ? input.resolution : undefined,
      duration:
        typeof input.duration === "number"
          ? input.duration
          : typeof input.duration === "string"
            ? parseInt(input.duration, 10)
            : undefined,
      mode: typeof input.mode === "string" ? input.mode : undefined,
      upscaleFactor: input.upscale_factor as string | number | undefined,
    });
  }

  const imageUrls = asStringArray(input.input_urls ?? input.image_urls);
  const imageModelKey =
    canonicalKey === "lib-nano-pro" ? activeModelKey : canonicalKey;
  return buildKieImageCreateArgs({
    modelKey: imageModelKey,
    prompt: String(input.prompt ?? input.message ?? ""),
    imageUrls: imageUrls.length ? imageUrls : undefined,
    params: input,
  });
}

async function requireBookGateway(userId: string) {
  await assertGatewayApiKeyLinkedForUser(userId);
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) throw new GatewayRequiredError("请先在 Book 关联 Gateway API Key");
  return auth;
}

export async function marketPlaygroundCreateTask(
  gatewayUser: GatewayUser,
  opts: {
    canonicalKey: string;
    input: Record<string, unknown>;
    billingPersona: "PLATFORM_CREDIT" | "BYOK" | null;
  },
): Promise<{ taskId: string; logId: string; providerKind: string }> {
  const bookUserId = await resolveGatewaySessionBookUserId(gatewayUser);
  if (!bookUserId) throw new Error("请先完成 Book 账号关联后再试");

  const detail = await getMarketModelDetail(
    opts.canonicalKey,
    gatewayUser.id,
    opts.billingPersona,
  );
  if (!detail) throw new Error("模型不存在或未上架");

  const auth = await requireBookGateway(bookUserId);
  const schema = getPlaygroundSchema(opts.canonicalKey, detail.requestKind);

  if (schema.mode === "chat") {
    const message = String(opts.input.message ?? "").trim();
    if (!message) throw new Error("message required");
    const result = await gatewayV1ChatCompletions({
      apiKeyId: auth.id,
      body: {
        model: detail.activeModelKey,
        messages: [{ role: "user", content: message }],
      },
      meta: gatewayV1ClientMeta(CLIENT_SOURCE, {
        clientPage: marketClientPage(opts.canonicalKey),
        bookUserId,
      }),
    });
    if (!result.logId) throw new Error("chat 请求未返回 logId");
    return {
      taskId: result.logId,
      logId: result.logId,
      providerKind: "CHAT",
    };
  }

  const { model, input } = buildCreateTaskBody(
    opts.canonicalKey,
    detail.activeModelKey,
    opts.input,
  );

  const created = await gatewayV1CreateTask({
    apiKeyId: auth.id,
    body: { model, input },
    meta: gatewayV1ClientMeta(CLIENT_SOURCE, {
      clientPage: marketClientPage(opts.canonicalKey),
      bookUserId,
    }),
  });

  return {
    taskId: created.taskId,
    logId: created.logId,
    providerKind: created.providerKind,
  };
}

export type MarketPollOutput = {
  task_status: string;
  video_url?: string;
  image_url?: string;
  text?: string;
  message?: string;
  raw?: unknown;
};

export async function marketPlaygroundPollTask(
  gatewayUser: GatewayUser,
  opts: { taskId: string; logId?: string; requestKind?: string },
): Promise<MarketPollOutput> {
  const bookUserId = await resolveGatewaySessionBookUserId(gatewayUser);
  if (!bookUserId) throw new Error("未关联 Book 账号");

  const auth = await requireBookGateway(bookUserId);

  if (opts.requestKind === "CHAT" && opts.logId) {
    const log = await prisma.gatewayRequestLog.findFirst({
      where: { id: opts.logId, apiKeyId: auth.id },
    });
    if (!log) return { task_status: "FAILED", message: "log not found" };
    if (log.status === "SUCCEEDED") {
      const rs = log.resultSummary as Record<string, unknown> | null;
      const text = typeof rs?.text === "string" ? rs.text : undefined;
      return { task_status: "SUCCEEDED", text, raw: rs };
    }
    if (log.status === "FAILED") {
      return { task_status: "FAILED", message: log.failMessage ?? "failed" };
    }
    return { task_status: "RUNNING" };
  }

  const polled = await gatewayV1RecordInfo({
    apiKeyId: auth.id,
    taskId: opts.taskId,
    meta: gatewayV1ClientMeta(CLIENT_SOURCE, { bookUserId }),
  });

  const record = polled.data as KieRecordResponse;
  const normalized = normalizeKieRecordForToolLab(record);
  const url = normalized.video_url ?? extractKieResultUrl(record) ?? undefined;
  const isVideo = url?.includes(".mp4") || url?.includes("video");
  return {
    ...normalized,
    video_url: isVideo ? url : normalized.video_url,
    image_url: !isVideo ? url : undefined,
    raw: record,
  };
}

export type MarketHistoryItem = {
  logId: string;
  taskId: string | null;
  submittedAt: string;
  previewUrl: string | null;
  mediaKind: "image" | "video" | "text";
  inputSummary: unknown;
};

function previewFromLog(log: {
  resultSummary: unknown;
  requestKind: string;
}): { url: string | null; mediaKind: "image" | "video" | "text" } {
  const rs = log.resultSummary;
  if (rs && typeof rs === "object") {
    const obj = rs as Record<string, unknown>;
    if (typeof obj.text === "string") {
      return { url: null, mediaKind: "text" };
    }
    const record = rs as KieRecordResponse;
    const url = extractKieResultUrl(record);
    if (url) {
      return {
        url,
        mediaKind: url.includes(".mp4") || url.includes("video") ? "video" : "image",
      };
    }
    if (typeof obj.video_url === "string") {
      return { url: obj.video_url, mediaKind: "video" };
    }
    if (typeof obj.image_url === "string") {
      return { url: obj.image_url, mediaKind: "image" };
    }
  }
  if (log.requestKind === "CHAT") {
    return { url: null, mediaKind: "text" };
  }
  return { url: null, mediaKind: "image" };
}

export async function listMarketPlaygroundHistory(
  gatewayUser: GatewayUser,
  opts: { canonicalKey: string; limit?: number },
): Promise<MarketHistoryItem[]> {
  const limit = Math.min(8, Math.max(1, opts.limit ?? 8));
  const where = await buildGatewayLogWhere(
    { gatewaySessionUser: gatewayUser },
    {
      status: "SUCCEEDED",
    },
  );

  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      AND: [
        where,
        { clientPage: marketClientPage(opts.canonicalKey) },
      ],
    },
    orderBy: { submittedAt: "desc" },
    take: limit,
    select: {
      id: true,
      externalTaskId: true,
      submittedAt: true,
      resultSummary: true,
      requestKind: true,
      inputSummary: true,
    },
  });

  return logs.map((l) => {
    const { url, mediaKind } = previewFromLog(l);
    return {
      logId: l.id,
      taskId: l.externalTaskId,
      submittedAt: l.submittedAt.toISOString(),
      previewUrl: url,
      mediaKind,
      inputSummary: l.inputSummary,
    };
  });
}

export async function marketPlaygroundUploadDataUrl(
  gatewayUser: GatewayUser,
  opts: { dataUrl: string; kind: "image" | "video" },
): Promise<{ url: string }> {
  const bookUserId = await resolveGatewaySessionBookUserId(gatewayUser);
  if (!bookUserId) throw new Error("未关联 Book 账号");

  const m = /^data:([^;]+);base64,(.+)$/i.exec(opts.dataUrl.trim());
  if (!m) throw new Error("无效 data URL");

  const contentType = m[1]!.trim();
  const buf = Buffer.from(m[2]!, "base64");
  const max = opts.kind === "video" ? 100 * 1024 * 1024 : 15 * 1024 * 1024;
  if (buf.length > max) throw new Error("文件过大");

  const { uploadCanvasUserBuffer } = await import("@/lib/canvas/canvas-oss");
  const ext =
    contentType.includes("jpeg") || contentType.includes("jpg")
      ? "jpg"
      : contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : contentType.includes("mp4")
            ? "mp4"
            : "bin";

  const url = await uploadCanvasUserBuffer({
    buf,
    contentType,
    userId: bookUserId,
    ext,
    preferBucketUrl: true,
  });
  return { url };
}
