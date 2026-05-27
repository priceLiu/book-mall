import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import { createDashscopeJobFromServer } from "@/lib/forward-gateway-dashscope-server";
import {
  buildI2vVideoBody,
  buildR2vVideoBody,
  buildT2vVideoBody,
} from "@/lib/image-to-video-dashscope";
import {
  getImageToVideoModelByApiModel,
  getReferenceToVideoModelByApiModel,
  getTextToVideoModelByApiModel,
  IMAGE_TO_VIDEO_MODELS,
  REFERENCE_TO_VIDEO_MODELS,
  TEXT_TO_VIDEO_MODELS,
  T2V_ASPECT_RATIO_OPTIONS,
  t2vAspectRatioToSize,
} from "@/lib/image-to-video-models";
import {
  reserveWalletHoldFromServer,
  releaseWalletHoldFromServer,
} from "@/lib/forward-tools-usage-server";
import { computeVideoChargePoints } from "@/lib/tools-scheme-a-pricing";
import { getSchemeARetailMultiplierServer } from "@/lib/scheme-a-retail-multiplier-server";

export const runtime = "nodejs";

const MAX_PROMPT = 8000;

const R2V_RATIOS = new Set([
  "16:9",
  "9:16",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "1:1",
]);

function normalizeReferenceVideoPrompt(prompt: string, imageCount: number): string {
  let out = prompt;
  for (let n = imageCount; n >= 1; n--) {
    const re = new RegExp(`character${n}(?![0-9])`, "gi");
    out = out.replace(re, `[Image ${n}]`);
  }
  return out;
}

/**
 * v003：图生/文生/参考生视频在调用云厂商前的"预占用"门禁。
 * 估算逻辑：按用户选择的 (模型, 时长, 分辨率) 用 catalog 单价 × 系数算出"预计扣点"，安全边际由主站 reserveWalletHold 再叠 1.2x。
 * 调用方式：成功返回 { ok:true, holdId, reservedPoints }；失败 402 直接透传给前端（避免无谓的云调用）。
 */
async function reserveBeforeVideoStart(input: {
  apiModel: string;
  durationSec: number;
  resolution: "720P" | "1080P";
  audio: boolean;
}): Promise<
  | { ok: true; holdId: string | null; reservedPoints: number }
  | { ok: false; status: number; data: Record<string, unknown> }
> {
  try {
    const { multiplier } = await getSchemeARetailMultiplierServer({
      toolKey: "image-to-video",
      modelKey: input.apiModel,
    });
    const sr = input.resolution === "1080P" ? 1080 : 720;
    const estimatedMaxPoints = computeVideoChargePoints(
      {
        apiModel: input.apiModel,
        durationSec: input.durationSec,
        sr,
        audio: input.audio,
      },
      multiplier,
    );
    if (estimatedMaxPoints <= 0) {
      // catalog 无该模型单价：不阻塞，但跳过 reserve（settle 时再尝试 ToolBillablePrice 命中）
      return { ok: true, holdId: null, reservedPoints: 0 };
    }
    const r = await reserveWalletHoldFromServer({
      toolKey: "image-to-video",
      action: "invoke",
      estimatedMaxPoints,
      meta: {
        modelId: input.apiModel,
        durationSec: input.durationSec,
        resolution: input.resolution,
        audio: input.audio,
      },
    });
    if (!r.ok) {
      return {
        ok: false,
        status: 503,
        data: { error: r.reason === "no_session" ? "请先登录工具站" : "工具站未配置 MAIN_SITE_ORIGIN" },
      };
    }
    if (r.status >= 200 && r.status < 300) {
      const holdId = typeof r.data.holdId === "string" ? r.data.holdId : null;
      const reservedPoints =
        typeof r.data.reservedPoints === "number" ? r.data.reservedPoints : 0;
      return { ok: true, holdId, reservedPoints };
    }
    return { ok: false, status: r.status, data: r.data };
  } catch (e) {
    console.error("[reserveBeforeVideoStart]", e);
    // 预占用失败不应阻塞业务流（运维问题），主站 settle 仍能扣对；这里 fail-open，holdId 留 null。
    return { ok: true, holdId: null, reservedPoints: 0 };
  }
}

async function submitVideoJob(opts: {
  model: string;
  videoBody: Record<string, unknown>;
  holdId: string | null;
  failReasonPrefix: string;
}): Promise<
  | { ok: true; taskId: string; gatewayLogId: string; holdId: string | null }
  | { ok: false; status: number; error: string; code?: string }
> {
  const created = await createDashscopeJobFromServer({
    kind: "video",
    model: opts.model,
    videoBody: opts.videoBody,
    clientPage: "image-to-video",
  });
  if (!created.ok) {
    if (opts.holdId) {
      await releaseWalletHoldFromServer({
        holdId: opts.holdId,
        reason: `${opts.failReasonPrefix}:${(created.error ?? "gateway").slice(0, 100)}`,
      });
    }
    return {
      ok: false,
      status: created.status ?? 502,
      error: created.error ?? "Gateway 调用失败",
      code: created.status === 403 ? "GATEWAY_KEY_REQUIRED" : undefined,
    };
  }
  return {
    ok: true,
    taskId: created.taskId,
    gatewayLogId: created.logId,
    holdId: opts.holdId,
  };
}

export async function POST(req: Request) {
  const suite = await requireToolSuiteNavAccess("image-to-video");
  if (!suite.ok) return suite.response;

  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "请先登录工具站" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const kindRaw = body.kind;
  const kind =
    kindRaw === "ref" || kindRaw === "t2v" ? kindRaw : "i2v";

  const prompt =
    typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT) : "";
  if (!prompt) {
    return NextResponse.json({ error: "请输入提示词" }, { status: 400 });
  }

  const resolutionRaw = body.resolution;
  const resolution =
    resolutionRaw === "720P" || resolutionRaw === "1080P"
      ? resolutionRaw
      : "1080P";

  const durRaw = body.duration;
  const duration =
    typeof durRaw === "number" && Number.isFinite(durRaw)
      ? Math.floor(durRaw)
      : typeof durRaw === "string" && /^\d+$/.test(durRaw.trim())
        ? parseInt(durRaw.trim(), 10)
        : 5;

  const seedStr =
    typeof body.seed === "string"
      ? body.seed
      : typeof body.seed === "number" && Number.isFinite(body.seed)
        ? String(Math.floor(body.seed))
        : undefined;

  const watermark = body.watermark === true;

  if (kind === "t2v") {
    const modelRaw =
      typeof body.model === "string" && body.model.trim()
        ? body.model.trim()
        : TEXT_TO_VIDEO_MODELS[0]!.apiModel;
    const modelEntry = getTextToVideoModelByApiModel(modelRaw);
    if (!modelEntry) {
      return NextResponse.json(
        { error: "不支持的文生视频模型，请刷新页面后重试" },
        { status: 400 },
      );
    }
    const aspectRaw =
      typeof body.aspectRatio === "string" ? body.aspectRatio.trim() : "";
    const aspectAllowed = new Set<string>(
      T2V_ASPECT_RATIO_OPTIONS as unknown as string[],
    );
    const aspectForSize = aspectAllowed.has(aspectRaw) ? aspectRaw : "16:9";
    const isHappyHorseT2v = modelEntry.apiModel.startsWith("happyhorse-");
    const happyhorseDur = Math.min(15, Math.max(3, duration));
    const wanDur: 5 | 10 = duration <= 7 ? 5 : 10;
    const estimatedDur = isHappyHorseT2v ? happyhorseDur : wanDur;
    const reserveT2v = await reserveBeforeVideoStart({
      apiModel: modelEntry.apiModel,
      durationSec: estimatedDur,
      resolution,
      audio: false,
    });
    if (!reserveT2v.ok) {
      return NextResponse.json(reserveT2v.data, { status: reserveT2v.status });
    }

    const built = isHappyHorseT2v
      ? buildT2vVideoBody({
          parameterExtras: modelEntry.defaultParameters,
          prompt,
          parameterStyle: "resolutionRatio",
          resolution,
          ratio: aspectForSize,
          duration: happyhorseDur,
          seedStr,
          watermark,
        })
      : buildT2vVideoBody({
          parameterExtras: modelEntry.defaultParameters,
          prompt,
          parameterStyle: "wanSize",
          size: t2vAspectRatioToSize(aspectForSize, resolution),
          duration: wanDur,
        });
    if (!built.ok) {
      if (reserveT2v.holdId) {
        await releaseWalletHoldFromServer({
          holdId: reserveT2v.holdId,
          reason: `t2v_build_failed:${built.error.slice(0, 100)}`,
        });
      }
      return NextResponse.json({ error: built.error }, { status: 400 });
    }

    const submitted = await submitVideoJob({
      model: modelEntry.apiModel,
      videoBody: built.body,
      holdId: reserveT2v.holdId,
      failReasonPrefix: "t2v_create_failed",
    });
    if (!submitted.ok) {
      return NextResponse.json(
        { error: submitted.error, code: submitted.code },
        { status: submitted.status },
      );
    }
    return NextResponse.json({
      taskId: submitted.taskId,
      gatewayLogId: submitted.gatewayLogId,
      holdId: submitted.holdId,
    });
  }

  if (kind === "ref") {
    const ratioRaw =
      typeof body.ratio === "string" ? body.ratio.trim() : "16:9";
    const ratio = R2V_RATIOS.has(ratioRaw) ? ratioRaw : "16:9";

    const refs = body.referenceImages;
    if (!Array.isArray(refs) || refs.length === 0) {
      return NextResponse.json(
        { error: "参考生视频须提交 1～9 张参考图（URL 或 Data URL）" },
        { status: 400 },
      );
    }
    const urls: string[] = [];
    for (const item of refs) {
      if (typeof item !== "string" || !item.trim()) {
        return NextResponse.json(
          { error: "referenceImages 每项须为非空字符串" },
          { status: 400 },
        );
      }
      urls.push(item.trim());
      if (urls.length >= 9) break;
    }
    if (urls.length < 1) {
      return NextResponse.json({ error: "参考图不能为空" }, { status: 400 });
    }

    const normalizedPrompt = normalizeReferenceVideoPrompt(prompt, urls.length);
    const refModelRaw =
      typeof body.model === "string" && body.model.trim()
        ? body.model.trim()
        : REFERENCE_TO_VIDEO_MODELS[0]!.apiModel;
    const refModelEntry = getReferenceToVideoModelByApiModel(refModelRaw);
    if (!refModelEntry) {
      return NextResponse.json(
        { error: "不支持的参考生视频模型，请刷新页面后重试" },
        { status: 400 },
      );
    }
    const reserveR2v = await reserveBeforeVideoStart({
      apiModel: refModelEntry.apiModel,
      durationSec: duration,
      resolution,
      audio: false,
    });
    if (!reserveR2v.ok) {
      return NextResponse.json(reserveR2v.data, { status: reserveR2v.status });
    }

    const built = buildR2vVideoBody({
      parameterExtras: refModelEntry.defaultParameters,
      prompt: normalizedPrompt,
      referenceImageUrls: urls,
      resolution,
      ratio,
      duration,
      seedStr,
      watermark,
    });
    if (!built.ok) {
      if (reserveR2v.holdId) {
        await releaseWalletHoldFromServer({
          holdId: reserveR2v.holdId,
          reason: `r2v_build_failed:${built.error.slice(0, 100)}`,
        });
      }
      return NextResponse.json({ error: built.error }, { status: 400 });
    }

    const submitted = await submitVideoJob({
      model: refModelEntry.apiModel,
      videoBody: built.body,
      holdId: reserveR2v.holdId,
      failReasonPrefix: "r2v_create_failed",
    });
    if (!submitted.ok) {
      return NextResponse.json(
        { error: submitted.error, code: submitted.code },
        { status: submitted.status },
      );
    }
    return NextResponse.json({
      taskId: submitted.taskId,
      gatewayLogId: submitted.gatewayLogId,
      holdId: submitted.holdId,
    });
  }

  const firstFrame =
    typeof body.firstFrame === "string" ? body.firstFrame.trim() : "";
  if (!firstFrame) {
    return NextResponse.json(
      { error: "缺少首帧图片（请上传或示例图转 Data URL 后提交）" },
      { status: 400 },
    );
  }

  const modelRaw =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : IMAGE_TO_VIDEO_MODELS[0]!.apiModel;
  const modelEntry = getImageToVideoModelByApiModel(modelRaw);
  if (!modelEntry) {
    return NextResponse.json(
      { error: "不支持的模型，请刷新页面后重试" },
      { status: 400 },
    );
  }

  const reserveI2v = await reserveBeforeVideoStart({
    apiModel: modelEntry.apiModel,
    durationSec: duration,
    resolution,
    audio: false,
  });
  if (!reserveI2v.ok) {
    return NextResponse.json(reserveI2v.data, { status: reserveI2v.status });
  }

  const built = buildI2vVideoBody({
    parameterExtras: modelEntry.defaultParameters,
    prompt,
    firstFrame,
    resolution,
    duration,
    seedStr,
    watermark,
  });
  if (!built.ok) {
    if (reserveI2v.holdId) {
      await releaseWalletHoldFromServer({
        holdId: reserveI2v.holdId,
        reason: `i2v_build_failed:${built.error.slice(0, 100)}`,
      });
    }
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  const submitted = await submitVideoJob({
    model: modelEntry.apiModel,
    videoBody: built.body,
    holdId: reserveI2v.holdId,
    failReasonPrefix: "i2v_create_failed",
  });
  if (!submitted.ok) {
    return NextResponse.json(
      { error: submitted.error, code: submitted.code },
      { status: submitted.status },
    );
  }

  return NextResponse.json({
    taskId: submitted.taskId,
    gatewayLogId: submitted.gatewayLogId,
    holdId: submitted.holdId,
  });
}
