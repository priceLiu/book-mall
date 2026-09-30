import { randomUUID } from "crypto";

import { assertEcomStoryboardImageEditRefs } from "@/lib/ecom/ecom-storyboard-image-edit";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import {
  ecomRatioFromPixelSize,
  resolveEcomGeneratePixelSize,
} from "@/lib/ecom/ecom-storyboard-gen-params";
import {
  getEcomModelTryonProject,
  saveEcomModelTryonResultToAssets,
  updateEcomModelTryonProject,
} from "@/lib/ecom/ecom-model-tryon-service";
import type { ModelTryonProjectDto } from "@/lib/ecom/ecom-model-tryon-types";
import { ECOM_MODEL_TRYON_TOOL_KEY } from "@/lib/ecom/ecom-model-tryon-types";
import { parseMentionedImageIndices } from "@/lib/ecom/ecom-seed-video-mention";
import {
  expandVtonTextTryonPromptSceneTokens,
  vtonTextTryonImageRefs,
} from "@/lib/ecom/ecom-vton-text-tryon-scene-prompt";
import {
  resolveVtonTextTryonModelKey,
  VTON_TEXT_TRYON_MODEL_KEYS,
} from "@/lib/ecom/ecom-vton-text-tryon-models";
import { ecomStoryboardImageEditMaxRefs } from "@/lib/ecom/ecom-storyboard-image-edit";
import { mergeVtonMeta, sanitizeVtonProjectMeta } from "@/lib/ecom/ecom-vton/meta";
import {
  enqueueDetached,
  isVtonAsyncJobRunning,
  vtonAsyncJobNow,
} from "@/lib/ecom/ecom-vton/async-job";
import type { VtonTextTryonJob, VtonTextTryonRef } from "@/lib/ecom/ecom-vton/types";
import { resolveMediaDecomposeUpload } from "@/lib/ecom/ecom-media-decompose-media";
import { persistEcomGenerationRecord } from "@/lib/ecom/ecom-generation-record";
import { ECOM_MODEL_TRYON_MODULE } from "@/lib/ecom/ecom-model-tryon-types";

function parseEcomPixelSize(size: string): { width: number; height: number } {
  const [widthRaw, heightRaw] = size.split("*");
  const width = Number(widthRaw);
  const height = Number(heightRaw);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return { width: 1080, height: 1440 };
  }
  return { width: Math.round(width), height: Math.round(height) };
}

export function resolveTextTryonRefUrls(
  refs: VtonTextTryonRef[],
  prompt: string,
  max: number,
): string[] {
  const images = vtonTextTryonImageRefs(refs);
  const mentioned = parseMentionedImageIndices(prompt);
  if (mentioned.length > 0) {
    return mentioned
      .map((n) => images[n - 1]?.ossUrl)
      .filter((u): u is string => Boolean(u?.trim()))
      .slice(0, max);
  }
  return images
    .map((r) => r.ossUrl)
    .filter((u): u is string => Boolean(u?.trim()))
    .slice(0, max);
}

async function appendTextTryonRef(
  userId: string,
  projectId: string,
  ossUrl: string,
  label?: string,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const meta = sanitizeVtonProjectMeta(project.meta);
  const refs = meta.textTryonRefs ?? [];

  const nextIndex = refs.length + 1;
  const imageCount = refs.filter((r) => r.ossUrl?.trim()).length;
  const entry: VtonTextTryonRef = {
    id: randomUUID(),
    kind: "image",
    ossUrl: ossUrl.trim(),
    label: label?.trim() || `图片${imageCount + 1}`,
    createdAt: new Date().toISOString(),
  };

  return updateEcomModelTryonProject(userId, projectId, {
    meta: mergeVtonMeta(meta, {
      textTryonRefs: [...refs, entry],
    }),
  });
}

export async function uploadEcomVtonTextTryonRef(
  userId: string,
  projectId: string,
  file: File,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const buf = Buffer.from(await file.arrayBuffer());
  const uploaded = await resolveMediaDecomposeUpload({
    userId,
    buf,
    contentType: file.type,
    fileName: file.name,
  });
  if (uploaded.kind !== "image") throw new Error("请上传图片");

  return appendTextTryonRef(userId, projectId, uploaded.ossUrl);
}

export async function attachEcomVtonTextTryonRef(
  userId: string,
  projectId: string,
  ossUrl: string,
  label?: string,
): Promise<ModelTryonProjectDto> {
  if (!ossUrl.trim()) throw new Error("缺少图片地址");
  return appendTextTryonRef(userId, projectId, ossUrl, label);
}

export async function attachEcomVtonTextTryonSceneRef(
  userId: string,
  projectId: string,
  opts: {
    label?: string;
    scenePrompt: string;
    sceneLibraryEntryId?: string;
    ossUrl?: string;
  },
): Promise<ModelTryonProjectDto> {
  const imageUrl = opts.ossUrl?.trim();
  if (imageUrl) {
    return appendTextTryonRef(userId, projectId, imageUrl, opts.label ?? "场景参考图");
  }

  const scenePrompt = opts.scenePrompt.trim();
  if (!scenePrompt) throw new Error("缺少场景描述");

  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const meta = sanitizeVtonProjectMeta(project.meta);
  const refs = meta.textTryonRefs ?? [];
  const sceneCount = refs.filter(
    (r) => r.kind === "scene-text" || (r.scenePrompt?.trim() && !r.ossUrl?.trim()),
  ).length;

  const entry: VtonTextTryonRef = {
    id: randomUUID(),
    kind: "scene-text",
    createdAt: new Date().toISOString(),
    label: opts.label?.trim() || `场景${sceneCount + 1}`,
    scenePrompt,
    sceneLibraryEntryId: opts.sceneLibraryEntryId?.trim() || undefined,
  };

  return updateEcomModelTryonProject(userId, projectId, {
    meta: mergeVtonMeta(meta, {
      textTryonRefs: [...refs, entry],
    }),
  });
}

export async function removeEcomVtonTextTryonRef(
  userId: string,
  projectId: string,
  refId: string,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const meta = sanitizeVtonProjectMeta(project.meta);
  const refs = (meta.textTryonRefs ?? []).filter((r) => r.id !== refId);
  return updateEcomModelTryonProject(userId, projectId, {
    meta: mergeVtonMeta(meta, { textTryonRefs: refs }),
  });
}

export async function patchEcomVtonTextTryonEditor(
  userId: string,
  projectId: string,
  patch: { prompt?: string; modelKey?: string },
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const meta = sanitizeVtonProjectMeta(project.meta);
  const settings = { ...project.settings };
  if (patch.modelKey !== undefined) {
    settings.textTryonModelKey = resolveVtonTextTryonModelKey(patch.modelKey);
  }

  const metaPatch: Partial<typeof meta> = {};
  if (patch.prompt !== undefined) metaPatch.textTryonPrompt = patch.prompt;

  const updated = await updateEcomModelTryonProject(userId, projectId, {
    settings,
    meta: mergeVtonMeta(meta, metaPatch),
  });
  return updated;
}

export async function clearEcomVtonTextTryonEditor(
  userId: string,
  projectId: string,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const meta = sanitizeVtonProjectMeta(project.meta);
  return updateEcomModelTryonProject(userId, projectId, {
    meta: mergeVtonMeta(meta, {
      textTryonRefs: [],
      textTryonPrompt: "",
      textTryonDemoSuppressed: true,
    }),
  });
}

type TextTryonGenerateOpts = {
  prompt?: string;
  modelKey?: string;
  imageSize?: string;
  ratio?: "3:4" | "4:5" | "1:1" | "9:16" | "16:9";
};

function resolveTextTryonGenerateInput(
  project: ModelTryonProjectDto,
  opts?: TextTryonGenerateOpts,
) {
  const meta = sanitizeVtonProjectMeta(project.meta);
  const refs = meta.textTryonRefs ?? [];
  const imageRefs = vtonTextTryonImageRefs(refs);
  if (imageRefs.length < 1) {
    throw new Error("请先上传至少 1 张参考图（模特 / 服装 / 配饰）");
  }

  const editorPrompt = (opts?.prompt ?? meta.textTryonPrompt ?? "").trim();
  if (!editorPrompt) throw new Error("请填写 Prompt，并用 @图片N / @场景N 引用参考");
  const prompt = expandVtonTextTryonPromptSceneTokens(editorPrompt, refs);

  const modelKey = resolveVtonTextTryonModelKey(
    opts?.modelKey ?? project.settings.textTryonModelKey,
  );
  if (!(VTON_TEXT_TRYON_MODEL_KEYS as readonly string[]).includes(modelKey)) {
    throw new Error("无效的生图模型");
  }

  const maxRefs = ecomStoryboardImageEditMaxRefs(modelKey);
  const refImageUrls = resolveTextTryonRefUrls(refs, prompt, maxRefs);
  assertEcomStoryboardImageEditRefs(modelKey, refImageUrls.length);

  const imageSize =
    opts?.imageSize?.trim() || project.settings.textTryonImageSize?.trim();
  const ratio = opts?.ratio ?? ecomRatioFromPixelSize(imageSize);
  const pixelSize = resolveEcomGeneratePixelSize({ modelKey, ratio, imageSize });

  return {
    meta,
    prompt,
    editorPrompt,
    modelKey,
    imageSize,
    ratio,
    pixelSize,
    refImageUrls,
  };
}

async function persistTextTryonJob(
  userId: string,
  projectId: string,
  job: VtonTextTryonJob,
): Promise<ModelTryonProjectDto> {
  const latest = await getEcomModelTryonProject(userId, projectId);
  if (!latest) throw new Error("项目不存在");
  return updateEcomModelTryonProject(userId, projectId, {
    meta: mergeVtonMeta(latest.meta, { textTryonJob: job }),
  });
}

async function runEcomVtonTextTryonImageJob(
  userId: string,
  projectId: string,
  job: VtonTextTryonJob,
  opts?: TextTryonGenerateOpts,
): Promise<void> {
  try {
    const project = await getEcomModelTryonProject(userId, projectId);
    if (!project) throw new Error("项目不存在");
    const { meta, prompt, editorPrompt, modelKey, imageSize, ratio, pixelSize, refImageUrls } =
      resolveTextTryonGenerateInput(project, {
        prompt: opts?.prompt ?? job.prompt,
        modelKey: opts?.modelKey ?? job.modelKey,
        imageSize: opts?.imageSize ?? job.imageSize,
        ratio: opts?.ratio,
      });
    const { width, height } = parseEcomPixelSize(pixelSize);
    const ossUrl = await generateEcomImage({
      userId,
      modelKey,
      prompt,
      ratio,
      imageSize: pixelSize,
      // 文生试衣必有参考图；不传则 wan2.7 丢掉 size，厂商默认横版 16:9
      wan27KeepPixelSizeWithRefs: true,
      refImageUrls,
      toolKey: `${ECOM_MODEL_TRYON_TOOL_KEY}__text-tryon`,
    });

    const createdAt = new Date().toISOString();
    const result = {
      id: randomUUID(),
      ossUrl,
      prompt: editorPrompt,
      modelKey,
      createdAt,
      ratio,
      width,
      height,
    };

    const autoTitle = `文生试衣 ${new Date(createdAt).toLocaleString("zh-CN")}`;
    try {
      await saveEcomModelTryonResultToAssets(userId, projectId, {
        ossUrl,
        title: autoTitle,
      });
    } catch (e) {
      console.warn("[vton-text-tryon] auto-save to tryon library failed:", e);
    }

    try {
      await persistEcomGenerationRecord({
        userId,
        ossUrl,
        title: autoTitle,
        prompt: editorPrompt,
        meta: {
          sourceModule: ECOM_MODEL_TRYON_MODULE,
          sourceToolKey: `${ECOM_MODEL_TRYON_TOOL_KEY}__text-tryon`,
          projectId,
          sourceResultId: result.id,
          versionKey: `${projectId}:${result.id}`,
          modelKey,
        },
      });
    } catch (e) {
      console.warn("[vton-text-tryon] auto-save to generation record failed:", e);
    }

    const latest = await getEcomModelTryonProject(userId, projectId);
    if (!latest) throw new Error("项目不存在");
    const latestMeta = sanitizeVtonProjectMeta(latest.meta);
    if (latestMeta.textTryonJob?.jobId !== job.jobId) return;

    await updateEcomModelTryonProject(userId, projectId, {
      meta: mergeVtonMeta(latestMeta, {
        textTryonPrompt: editorPrompt,
        textTryonResults: [result, ...(latestMeta.textTryonResults ?? [])],
        textTryonJob: {
          ...job,
          status: "done",
          updatedAt: vtonAsyncJobNow(),
          prompt: editorPrompt,
          modelKey,
          imageSize,
        },
      }),
      settings: {
        ...latest.settings,
        textTryonModelKey: modelKey,
        ...(imageSize ? { textTryonImageSize: imageSize } : {}),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    try {
      const latest = await getEcomModelTryonProject(userId, projectId);
      if (!latest) return;
      const latestMeta = sanitizeVtonProjectMeta(latest.meta);
      if (latestMeta.textTryonJob?.jobId !== job.jobId) return;
      await persistTextTryonJob(userId, projectId, {
        ...job,
        status: "failed",
        updatedAt: vtonAsyncJobNow(),
        error: message,
      });
    } catch (persistErr) {
      console.error("[vton-text-tryon] persist failed job:", persistErr);
    }
  }
}

/** 落库 running 后立即返回；生图在后台继续，刷新后可轮询 */
export async function startEcomVtonTextTryonImage(
  userId: string,
  projectId: string,
  opts?: TextTryonGenerateOpts,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const { meta, editorPrompt, modelKey, imageSize } = resolveTextTryonGenerateInput(
    project,
    opts,
  );
  if (isVtonAsyncJobRunning(meta.textTryonJob)) {
    return project;
  }

  const now = vtonAsyncJobNow();
  const job: VtonTextTryonJob = {
    jobId: randomUUID(),
    status: "running",
    startedAt: now,
    updatedAt: now,
    prompt: editorPrompt,
    modelKey,
    ...(imageSize ? { imageSize } : {}),
  };

  const started = await updateEcomModelTryonProject(userId, projectId, {
    meta: mergeVtonMeta(meta, {
      textTryonPrompt: editorPrompt,
      textTryonJob: job,
    }),
    settings: {
      ...project.settings,
      textTryonModelKey: modelKey,
      ...(imageSize ? { textTryonImageSize: imageSize } : {}),
    },
  });

  enqueueDetached("vton-text-tryon", () =>
    runEcomVtonTextTryonImageJob(userId, projectId, job, opts),
  );
  return started;
}

export async function generateEcomVtonTextTryonImage(
  userId: string,
  projectId: string,
  opts?: TextTryonGenerateOpts,
): Promise<ModelTryonProjectDto> {
  return startEcomVtonTextTryonImage(userId, projectId, opts);
}
