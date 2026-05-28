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

async function submitVideoJob(opts: {
  model: string;
  videoBody: Record<string, unknown>;
}): Promise<
  | { ok: true; taskId: string; gatewayLogId: string }
  | { ok: false; status: number; error: string; code?: string }
> {
  const created = await createDashscopeJobFromServer({
    kind: "video",
    model: opts.model,
    videoBody: opts.videoBody,
    clientPage: "image-to-video",
  });
  if (!created.ok) {
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
      return NextResponse.json({ error: built.error }, { status: 400 });
    }

    const submitted = await submitVideoJob({
      model: modelEntry.apiModel,
      videoBody: built.body,
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
      holdId: null,
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
      return NextResponse.json({ error: built.error }, { status: 400 });
    }

    const submitted = await submitVideoJob({
      model: refModelEntry.apiModel,
      videoBody: built.body,
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
      holdId: null,
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
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  const submitted = await submitVideoJob({
    model: modelEntry.apiModel,
    videoBody: built.body,
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
    holdId: null,
  });
}
