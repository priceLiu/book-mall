import { NextResponse } from "next/server";

import {
  ecomImageProcessingAvatar,
  ecomImageProcessingBgRemove,
  ecomImageProcessingCameraAngle,
  ecomImageProcessingDeblur,
  ecomImageProcessingEditor,
  ecomImageProcessingEnhancer,
  ecomImageProcessingFaceSwap,
  ecomImageProcessingGif,
  ecomImageProcessingMeme,
  ecomImageProcessingObjectRemove,
  ecomImageProcessingOutpaint,
  ecomImageProcessingPoster,
  ecomImageProcessingRestore,
  ecomImageProcessingRetouch,
} from "@/lib/ecom/ecom-image-processing";
import {
  ECOM_OUTPAINT_MODEL_KEY,
  ECOM_QWEN_EDIT_MODEL_KEYS,
  ECOM_SEEDREAM_EDITOR_MODEL_KEY,
  ECOM_WANX_PAINTING_MODEL_KEY,
  isQwenEditModelKey,
} from "@/lib/ecom/ecom-image-processing-models";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RETOUCH_MODELS = new Set<string>([
  ...ECOM_QWEN_EDIT_MODEL_KEYS,
  ECOM_WANX_PAINTING_MODEL_KEY,
]);

const RESTORE_FACE_SWAP_MODELS = new Set<string>([
  ...ECOM_QWEN_EDIT_MODEL_KEYS,
  "doubao-seedream-5-0-lite",
  ECOM_SEEDREAM_EDITOR_MODEL_KEY,
]);

function parseImageList(body: Record<string, unknown>): string[] {
  if (Array.isArray(body.sourceImageDataUrls)) {
    return body.sourceImageDataUrls
      .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      .map((u) => u.trim());
  }
  const single =
    typeof body.sourceImageDataUrl === "string"
      ? body.sourceImageDataUrl.trim()
      : "";
  return single ? [single] : [];
}

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const mode = typeof body.mode === "string" ? body.mode.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const parameters =
    body.parameters && typeof body.parameters === "object"
      ? (body.parameters as Record<string, unknown>)
      : undefined;

  try {
    if (mode === "retouch") {
      const model = typeof body.model === "string" ? body.model.trim() : "";
      const sourceImageDataUrl =
        typeof body.sourceImageDataUrl === "string"
          ? body.sourceImageDataUrl.trim()
          : "";
      const maskImageDataUrl =
        typeof body.maskImageDataUrl === "string"
          ? body.maskImageDataUrl.trim()
          : undefined;
      if (!RETOUCH_MODELS.has(model)) {
        return NextResponse.json({ error: "无效修图模型" }, { status: 400 });
      }
      if (!sourceImageDataUrl) {
        return NextResponse.json({ error: "请上传图片" }, { status: 400 });
      }
      if (!prompt) {
        return NextResponse.json({ error: "prompt 必填" }, { status: 400 });
      }
      const result = await ecomImageProcessingRetouch({
        userId: auth.userId,
        model,
        prompt,
        sourceImageDataUrl,
        maskImageDataUrl,
        parameters,
      });
      return NextResponse.json({
        assets: result.results.map((r) => r.asset),
        imageUrls: result.results.map((r) => r.ossUrl),
        logId: result.logId,
        model,
      });
    }

    if (mode === "enhancer") {
      const model = typeof body.model === "string" ? body.model.trim() : "";
      const sourceImageDataUrl =
        typeof body.sourceImageDataUrl === "string"
          ? body.sourceImageDataUrl.trim()
          : "";
      const enhancerStyle =
        typeof body.enhancerStyle === "string" ? body.enhancerStyle.trim() : "standard";
      if (!isQwenEditModelKey(model)) {
        return NextResponse.json({ error: "无效增强模型" }, { status: 400 });
      }
      if (!sourceImageDataUrl) {
        return NextResponse.json({ error: "请上传图片" }, { status: 400 });
      }
      const result = await ecomImageProcessingEnhancer({
        userId: auth.userId,
        model,
        prompt,
        enhancerStyle,
        sourceImageDataUrl,
        parameters,
      });
      return NextResponse.json({
        assets: result.results.map((r) => r.asset),
        imageUrls: result.results.map((r) => r.ossUrl),
        logId: result.logId,
        model,
      });
    }

    if (mode === "outpaint") {
      const model =
        typeof body.model === "string" && body.model.trim()
          ? body.model.trim()
          : ECOM_OUTPAINT_MODEL_KEY;
      const sourceImageDataUrl =
        typeof body.sourceImageDataUrl === "string"
          ? body.sourceImageDataUrl.trim()
          : "";
      if (!sourceImageDataUrl) {
        return NextResponse.json({ error: "请上传图片" }, { status: 400 });
      }
      const result = await ecomImageProcessingOutpaint({
        userId: auth.userId,
        model,
        prompt: prompt || undefined,
        sourceImageDataUrl,
        parameters,
      });
      return NextResponse.json({
        assets: result.results.map((r) => r.asset),
        imageUrls: result.results.map((r) => r.ossUrl),
        logId: result.logId,
        model,
      });
    }

    if (mode === "restore") {
      const model = typeof body.model === "string" ? body.model.trim() : "";
      const sourceImageDataUrl =
        typeof body.sourceImageDataUrl === "string"
          ? body.sourceImageDataUrl.trim()
          : "";
      if (!RESTORE_FACE_SWAP_MODELS.has(model)) {
        return NextResponse.json({ error: "无效修复模型" }, { status: 400 });
      }
      if (!sourceImageDataUrl) {
        return NextResponse.json({ error: "请上传图片" }, { status: 400 });
      }
      const result = await ecomImageProcessingRestore({
        userId: auth.userId,
        model,
        sourceImageDataUrl,
        repairType:
          typeof body.repairType === "string" ? body.repairType.trim() : "auto",
        upscaleFactor:
          typeof body.upscaleFactor === "string"
            ? body.upscaleFactor.trim()
            : "1",
        parameters,
      });
      return NextResponse.json({
        assets: result.results.map((r) => r.asset),
        imageUrls: result.results.map((r) => r.ossUrl),
        logId: result.logId,
        model,
      });
    }

    if (mode === "face-swap") {
      const model = typeof body.model === "string" ? body.model.trim() : "";
      const sourceFaceDataUrl =
        typeof body.sourceFaceDataUrl === "string"
          ? body.sourceFaceDataUrl.trim()
          : "";
      const targetImageDataUrl =
        typeof body.targetImageDataUrl === "string"
          ? body.targetImageDataUrl.trim()
          : "";
      if (!RESTORE_FACE_SWAP_MODELS.has(model)) {
        return NextResponse.json({ error: "无效换脸模型" }, { status: 400 });
      }
      if (!sourceFaceDataUrl || !targetImageDataUrl) {
        return NextResponse.json({ error: "请上传源脸与目标图" }, { status: 400 });
      }
      const result = await ecomImageProcessingFaceSwap({
        userId: auth.userId,
        model,
        sourceFaceDataUrl,
        targetImageDataUrl,
        blendMode:
          typeof body.blendMode === "string" ? body.blendMode.trim() : "natural",
        postProcess:
          typeof body.postProcess === "string"
            ? body.postProcess.trim()
            : "auto-beauty",
        algorithm:
          typeof body.algorithm === "string" ? body.algorithm.trim() : "standard",
        parameters,
      });
      return NextResponse.json({
        assets: result.results.map((r) => r.asset),
        imageUrls: result.results.map((r) => r.ossUrl),
        logId: result.logId,
        model,
      });
    }

    if (mode === "editor") {
      const model =
        typeof body.model === "string" && body.model.trim()
          ? body.model.trim()
          : ECOM_SEEDREAM_EDITOR_MODEL_KEY;
      const images = parseImageList(body);
      if (!prompt) {
        return NextResponse.json({ error: "prompt 必填" }, { status: 400 });
      }
      const result = await ecomImageProcessingEditor({
        userId: auth.userId,
        prompt,
        sourceImageDataUrls: images,
        parameters,
        model,
      });
      return NextResponse.json({
        assets: result.results.map((r) => r.asset),
        imageUrls: result.results.map((r) => r.ossUrl),
        logId: result.logId,
        model,
      });
    }

    if (mode === "bg-remove") {
      const sourceImageDataUrl =
        typeof body.sourceImageDataUrl === "string"
          ? body.sourceImageDataUrl.trim()
          : "";
      if (!sourceImageDataUrl) {
        return NextResponse.json({ error: "请上传图片" }, { status: 400 });
      }
      const styleFromParams =
        parameters?.styleImageDataUrl &&
        typeof parameters.styleImageDataUrl === "string"
          ? parameters.styleImageDataUrl
          : typeof body.styleImageDataUrl === "string"
            ? body.styleImageDataUrl.trim()
            : undefined;
      const result = await ecomImageProcessingBgRemove({
        userId: auth.userId,
        sourceImageDataUrl,
        model: typeof body.model === "string" ? body.model.trim() : undefined,
        generativeModel:
          typeof body.generativeModel === "string"
            ? body.generativeModel.trim()
            : undefined,
        bgMode: typeof body.bgMode === "string" ? body.bgMode.trim() : "transparent",
        edgeQuality:
          typeof body.edgeQuality === "string" ? body.edgeQuality.trim() : "auto",
        outputFormat:
          typeof body.outputFormat === "string" ? body.outputFormat.trim() : "png",
        customColor:
          typeof body.customColor === "string" ? body.customColor.trim() : undefined,
        styleImageDataUrl: styleFromParams,
        parameters,
      });
      return NextResponse.json({
        assets: result.results.map((r) => r.asset),
        imageUrls: result.results.map((r) => r.ossUrl),
        logId: result.logId,
        model:
          (typeof body.generativeModel === "string" && body.generativeModel) ||
          (typeof body.model === "string" && body.model) ||
          undefined,
      });
    }

    if (mode === "object-remove") {
      const sourceImageDataUrl =
        typeof body.sourceImageDataUrl === "string"
          ? body.sourceImageDataUrl.trim()
          : "";
      if (!sourceImageDataUrl) {
        return NextResponse.json({ error: "请上传图片" }, { status: 400 });
      }
      if (!prompt) {
        return NextResponse.json({ error: "prompt 必填" }, { status: 400 });
      }
      const styleFromParams =
        parameters?.styleImageDataUrl &&
        typeof parameters.styleImageDataUrl === "string"
          ? parameters.styleImageDataUrl
          : typeof body.styleImageDataUrl === "string"
            ? body.styleImageDataUrl.trim()
            : undefined;
      const result = await ecomImageProcessingObjectRemove({
        userId: auth.userId,
        sourceImageDataUrl,
        prompt,
        model: typeof body.model === "string" ? body.model.trim() : undefined,
        generativeModel:
          typeof body.generativeModel === "string"
            ? body.generativeModel.trim()
            : undefined,
        removalMode:
          typeof body.removalMode === "string" ? body.removalMode.trim() : "auto",
        outputFormat:
          typeof body.outputFormat === "string" ? body.outputFormat.trim() : "png",
        styleImageDataUrl: styleFromParams,
        parameters,
      });
      return NextResponse.json({
        assets: result.results.map((r) => r.asset),
        imageUrls: result.results.map((r) => r.ossUrl),
        logId: result.logId,
        model: body.generativeModel ?? body.model,
      });
    }

    if (mode === "deblur") {
      const sourceImageDataUrl =
        typeof body.sourceImageDataUrl === "string"
          ? body.sourceImageDataUrl.trim()
          : "";
      if (!sourceImageDataUrl) {
        return NextResponse.json({ error: "请上传图片" }, { status: 400 });
      }
      const styleFromParams =
        parameters?.styleImageDataUrl &&
        typeof parameters.styleImageDataUrl === "string"
          ? parameters.styleImageDataUrl
          : typeof body.styleImageDataUrl === "string"
            ? body.styleImageDataUrl.trim()
            : undefined;
      const result = await ecomImageProcessingDeblur({
        userId: auth.userId,
        sourceImageDataUrl,
        model: typeof body.model === "string" ? body.model.trim() : undefined,
        generativeModel:
          typeof body.generativeModel === "string"
            ? body.generativeModel.trim()
            : undefined,
        blurType:
          typeof body.blurType === "string" ? body.blurType.trim() : "auto",
        sharpenStrength:
          typeof body.sharpenStrength === "string"
            ? body.sharpenStrength.trim()
            : "medium",
        styleImageDataUrl: styleFromParams,
        parameters,
      });
      return NextResponse.json({
        assets: result.results.map((r) => r.asset),
        imageUrls: result.results.map((r) => r.ossUrl),
        logId: result.logId,
        model: body.generativeModel ?? body.model,
      });
    }

    if (mode === "camera-angle") {
      const sourceImageDataUrl =
        typeof body.sourceImageDataUrl === "string"
          ? body.sourceImageDataUrl.trim()
          : "";
      if (!sourceImageDataUrl) {
        return NextResponse.json({ error: "请上传图片" }, { status: 400 });
      }
      const styleFromParams =
        parameters?.styleImageDataUrl &&
        typeof parameters.styleImageDataUrl === "string"
          ? parameters.styleImageDataUrl
          : typeof body.styleImageDataUrl === "string"
            ? body.styleImageDataUrl.trim()
            : undefined;
      const result = await ecomImageProcessingCameraAngle({
        userId: auth.userId,
        sourceImageDataUrl,
        model: typeof body.model === "string" ? body.model.trim() : undefined,
        generativeModel:
          typeof body.generativeModel === "string"
            ? body.generativeModel.trim()
            : undefined,
        cameraAngle:
          typeof body.cameraAngle === "string"
            ? body.cameraAngle.trim()
            : "three-quarter",
        extraGuidance:
          typeof body.extraGuidance === "string"
            ? body.extraGuidance.trim()
            : undefined,
        styleImageDataUrl: styleFromParams,
        parameters,
      });
      return NextResponse.json({
        assets: result.results.map((r) => r.asset),
        imageUrls: result.results.map((r) => r.ossUrl),
        logId: result.logId,
        model: body.generativeModel ?? body.model,
      });
    }

    if (mode === "poster") {
      const sceneDescription =
        typeof body.sceneDescription === "string"
          ? body.sceneDescription.trim()
          : prompt;
      if (!sceneDescription) {
        return NextResponse.json({ error: "请填写场景描述" }, { status: 400 });
      }
      const styleFromParams =
        parameters?.styleImageDataUrl &&
        typeof parameters.styleImageDataUrl === "string"
          ? parameters.styleImageDataUrl
          : typeof body.styleImageDataUrl === "string"
            ? body.styleImageDataUrl.trim()
            : undefined;
      const result = await ecomImageProcessingPoster({
        userId: auth.userId,
        title: typeof body.title === "string" ? body.title.trim() : "",
        subtitle:
          typeof body.subtitle === "string" ? body.subtitle.trim() : undefined,
        sceneDescription,
        model: typeof body.model === "string" ? body.model.trim() : undefined,
        generativeModel:
          typeof body.generativeModel === "string"
            ? body.generativeModel.trim()
            : undefined,
        posterStyle:
          typeof body.posterStyle === "string"
            ? body.posterStyle.trim()
            : "concert",
        printFormat:
          typeof body.printFormat === "string"
            ? body.printFormat.trim()
            : undefined,
        styleImageDataUrl: styleFromParams,
        parameters,
      });
      return NextResponse.json({
        assets: result.results.map((r) => r.asset),
        imageUrls: result.results.map((r) => r.ossUrl),
        logId: result.logId,
        model: body.generativeModel ?? body.model,
      });
    }

    if (mode === "meme") {
      const sceneDescription =
        typeof body.sceneDescription === "string"
          ? body.sceneDescription.trim()
          : prompt;
      if (!sceneDescription) {
        return NextResponse.json({ error: "请描述场景" }, { status: 400 });
      }
      const styleFromParams =
        parameters?.styleImageDataUrl &&
        typeof parameters.styleImageDataUrl === "string"
          ? parameters.styleImageDataUrl
          : typeof body.styleImageDataUrl === "string"
            ? body.styleImageDataUrl.trim()
            : undefined;
      const result = await ecomImageProcessingMeme({
        userId: auth.userId,
        sceneDescription,
        generativeModel:
          typeof body.generativeModel === "string"
            ? body.generativeModel.trim()
            : undefined,
        memeFormat:
          typeof body.memeFormat === "string" ? body.memeFormat.trim() : "classic",
        topText: typeof body.topText === "string" ? body.topText.trim() : undefined,
        bottomText:
          typeof body.bottomText === "string" ? body.bottomText.trim() : undefined,
        textStyle:
          typeof body.textStyle === "string" ? body.textStyle.trim() : undefined,
        styleImageDataUrl: styleFromParams,
        parameters,
      });
      return NextResponse.json({
        assets: result.results.map((r) => r.asset),
        imageUrls: result.results.map((r) => r.ossUrl),
        logId: result.logId,
        model: body.generativeModel,
      });
    }

    if (mode === "avatar") {
      const characterDescription =
        typeof body.characterDescription === "string"
          ? body.characterDescription.trim()
          : prompt;
      if (!characterDescription) {
        return NextResponse.json({ error: "请描述角色" }, { status: 400 });
      }
      const styleFromParams =
        parameters?.styleImageDataUrl &&
        typeof parameters.styleImageDataUrl === "string"
          ? parameters.styleImageDataUrl
          : typeof body.styleImageDataUrl === "string"
            ? body.styleImageDataUrl.trim()
            : undefined;
      const result = await ecomImageProcessingAvatar({
        userId: auth.userId,
        characterDescription,
        generativeModel:
          typeof body.generativeModel === "string"
            ? body.generativeModel.trim()
            : undefined,
        avatarStyle:
          typeof body.avatarStyle === "string"
            ? body.avatarStyle.trim()
            : "pixar-3d",
        cropShape:
          typeof body.cropShape === "string" ? body.cropShape.trim() : "circle",
        styleImageDataUrl: styleFromParams,
        parameters,
      });
      return NextResponse.json({
        assets: result.results.map((r) => r.asset),
        imageUrls: result.results.map((r) => r.ossUrl),
        logId: result.logId,
        model: body.generativeModel,
      });
    }

    if (mode === "gif") {
      const animationDescription =
        typeof body.animationDescription === "string"
          ? body.animationDescription.trim()
          : prompt;
      if (!animationDescription) {
        return NextResponse.json({ error: "请描述动画" }, { status: 400 });
      }
      const styleFromParams =
        parameters?.styleImageDataUrl &&
        typeof parameters.styleImageDataUrl === "string"
          ? parameters.styleImageDataUrl
          : typeof body.styleImageDataUrl === "string"
            ? body.styleImageDataUrl.trim()
            : undefined;
      const result = await ecomImageProcessingGif({
        userId: auth.userId,
        animationDescription,
        generativeModel:
          typeof body.generativeModel === "string"
            ? body.generativeModel.trim()
            : undefined,
        animationType:
          typeof body.animationType === "string"
            ? body.animationType.trim()
            : "seamless-loop",
        durationSec:
          typeof body.durationSec === "string" ? body.durationSec.trim() : "2",
        gifSize: typeof body.gifSize === "string" ? body.gifSize.trim() : "480",
        frameRate:
          typeof body.frameRate === "string" ? body.frameRate.trim() : "24",
        styleImageDataUrl: styleFromParams,
        parameters,
      });
      return NextResponse.json({
        assets: result.results.map((r) => r.asset),
        imageUrls: result.results.map((r) => r.ossUrl),
        logId: result.logId,
        model: body.generativeModel,
      });
    }

    return NextResponse.json({
      error:
        "mode 须为 retouch、editor、enhancer、outpaint、restore、face-swap、bg-remove、object-remove、deblur、camera-angle、poster、meme、avatar 或 gif",
    }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "处理失败";
    const status =
      message.includes("余额") || message.includes("Gateway")
        ? 402
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
