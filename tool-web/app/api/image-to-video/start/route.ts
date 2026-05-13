import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import { getQwenApiKey } from "@/lib/qwen-env";
import {
  i2vCreateVideoTask,
  r2vCreateReferenceVideoTask,
  t2vCreateVideoTask,
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

export async function POST(req: Request) {
  const suite = await requireToolSuiteNavAccess("image-to-video");
  if (!suite.ok) return suite.response;

  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "请先登录工具站" }, { status: 401 });
  }

  const apiKey = getQwenApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "服务端未配置 QWEN_API_KEY 或 DASHSCOPE_API_KEY，无法调用视频合成（北京地域）",
      },
      { status: 503 },
    );
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
    const created = isHappyHorseT2v
      ? await t2vCreateVideoTask({
          apiKey,
          model: modelEntry.apiModel,
          parameterExtras: modelEntry.defaultParameters,
          prompt,
          parameterStyle: "resolutionRatio",
          resolution,
          ratio: aspectForSize,
          duration: Math.min(15, Math.max(3, duration)),
          seedStr,
          watermark,
        })
      : await t2vCreateVideoTask({
          apiKey,
          model: modelEntry.apiModel,
          parameterExtras: modelEntry.defaultParameters,
          prompt,
          parameterStyle: "wanSize",
          size: t2vAspectRatioToSize(aspectForSize, resolution),
          duration: duration <= 7 ? 5 : 10,
        });
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: 502 });
    }
    return NextResponse.json({ taskId: created.taskId });
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
    const created = await r2vCreateReferenceVideoTask({
      apiKey,
      model: refModelEntry.apiModel,
      parameterExtras: refModelEntry.defaultParameters,
      prompt: normalizedPrompt,
      referenceImageUrls: urls,
      resolution,
      ratio,
      duration,
      seedStr,
      watermark,
    });
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: 502 });
    }
    return NextResponse.json({ taskId: created.taskId });
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

  const created = await i2vCreateVideoTask({
    apiKey,
    model: modelEntry.apiModel,
    parameterExtras: modelEntry.defaultParameters,
    prompt,
    firstFrame,
    resolution,
    duration,
    seedStr,
    watermark,
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 502 });
  }

  return NextResponse.json({ taskId: created.taskId });
}
