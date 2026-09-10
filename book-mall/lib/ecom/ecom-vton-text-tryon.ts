import { randomUUID } from "crypto";

import { assertEcomStoryboardImageEditRefs } from "@/lib/ecom/ecom-storyboard-image-edit";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import type { EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";
import { resolveEcomGeneratePixelSize } from "@/lib/ecom/ecom-storyboard-gen-params";
import {
  getEcomModelTryonProject,
  saveEcomModelTryonResultToAssets,
  updateEcomModelTryonProject,
} from "@/lib/ecom/ecom-model-tryon-service";
import type { ModelTryonProjectDto } from "@/lib/ecom/ecom-model-tryon-types";
import { ECOM_MODEL_TRYON_TOOL_KEY } from "@/lib/ecom/ecom-model-tryon-types";
import { parseMentionedImageIndices } from "@/lib/ecom/ecom-seed-video-mention";
import {
  resolveVtonTextTryonModelKey,
  VTON_TEXT_TRYON_MODEL_KEYS,
} from "@/lib/ecom/ecom-vton-text-tryon-models";
import { ecomStoryboardImageEditMaxRefs } from "@/lib/ecom/ecom-storyboard-image-edit";
import { mergeVtonMeta, sanitizeVtonProjectMeta } from "@/lib/ecom/ecom-vton/meta";
import type { VtonTextTryonRef } from "@/lib/ecom/ecom-vton/types";
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
  const mentioned = parseMentionedImageIndices(prompt);
  if (mentioned.length > 0) {
    return mentioned
      .map((n) => refs[n - 1]?.ossUrl)
      .filter((u): u is string => Boolean(u?.trim()))
      .slice(0, max);
  }
  return refs
    .map((r) => r.ossUrl)
    .filter((u) => u.trim())
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
  const entry: VtonTextTryonRef = {
    id: randomUUID(),
    ossUrl: ossUrl.trim(),
    label: label?.trim() || `图片${nextIndex}`,
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

export async function generateEcomVtonTextTryonImage(
  userId: string,
  projectId: string,
  opts?: { prompt?: string; modelKey?: string; ratio?: "3:4" | "4:5" | "1:1" },
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const meta = sanitizeVtonProjectMeta(project.meta);
  const refs = meta.textTryonRefs ?? [];
  if (refs.length < 1) {
    throw new Error("请先上传至少 1 张参考图（模特 / 服装 / 配饰）");
  }

  const prompt = (opts?.prompt ?? meta.textTryonPrompt ?? "").trim();
  if (!prompt) throw new Error("请填写 Prompt，并用 @图片N 引用参考图");

  const modelKey = resolveVtonTextTryonModelKey(
    opts?.modelKey ?? project.settings.textTryonModelKey,
  );
  if (!(VTON_TEXT_TRYON_MODEL_KEYS as readonly string[]).includes(modelKey)) {
    throw new Error("无效的生图模型");
  }

  const maxRefs = ecomStoryboardImageEditMaxRefs(modelKey);
  const refImageUrls = resolveTextTryonRefUrls(refs, prompt, maxRefs);
  assertEcomStoryboardImageEditRefs(modelKey, refImageUrls.length);

  const ratio: EcomImageRatio = opts?.ratio ?? "3:4";
  const pixelSize = resolveEcomGeneratePixelSize({ modelKey, ratio });
  const { width, height } = parseEcomPixelSize(pixelSize);
  const ossUrl = await generateEcomImage({
    userId,
    modelKey,
    prompt,
    ratio,
    refImageUrls,
    toolKey: `${ECOM_MODEL_TRYON_TOOL_KEY}__text-tryon`,
  });

  const createdAt = new Date().toISOString();
  const result = {
    id: randomUUID(),
    ossUrl,
    prompt,
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
      prompt,
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

  const prevResults = meta.textTryonResults ?? [];
  return updateEcomModelTryonProject(userId, projectId, {
    meta: mergeVtonMeta(meta, {
      textTryonPrompt: prompt,
      textTryonResults: [result, ...prevResults],
    }),
    settings: {
      ...project.settings,
      textTryonModelKey: modelKey,
    },
  });
}
