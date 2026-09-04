import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { getSceneLibraryEntry, readSceneLibraryCatalogForUser } from "@/lib/ecom/ecom-scene-library-service";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import {
  resolveOutfitFusionModelKey,
} from "@/lib/ecom/ecom-outfit-video-fusion-models";
import {
  buildOutfitFollowReferenceSceneFragment,
  buildOutfitSceneFusionPositivePrompt,
  OUTFIT_SCENE_FUSION_NEGATIVE_PROMPT_ZH,
} from "@/lib/ecom/ecom-outfit-video-scene-fusion-prompts";
import { ECOM_OUTFIT_VIDEO_TOOL_KEY } from "@/lib/ecom/ecom-outfit-video-types";
import { ensureStoryboardRefImagesForWan27 } from "@/lib/ecom/ecom-storyboard-ref-image";
import { resolveStoryboardWan27JobSize } from "@/lib/ecom/ecom-storyboard-gen-params";
import {
  isWan26ImageModel,
  resolveStoryboardDashscopeModel,
} from "@/lib/ecom/ecom-storyboard-image-models";
import {
  ecomGwCreateDashscopeJob,
  ecomGwPollDashscope,
} from "@/lib/gateway/ecom-tool-gateway-client";
import {
  isQwenImage30ProModel,
  isQwenImageEditModel,
} from "@/lib/gateway/qwen-image-edit-proxy";
import type { OutfitSceneFusion, SceneShot, WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";
import { resolveOutfitDressedImageUrl } from "@/lib/ecom/video-workflow/templates/outfit-v1/generation";

export type OutfitSceneFusionMode = NonNullable<OutfitSceneFusion["mode"]>;

async function pollFusionImage(userId: string, taskId: string, logId: string): Promise<string> {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const polled = await ecomGwPollDashscope(userId, { taskId, gatewayLogId: logId });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      return polled.outputUrl;
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "场景融图失败");
    }
  }
  throw new Error("场景融图超时，请稍后重试");
}

async function persistFusionImage(userId: string, vendorUrl: string): Promise<string> {
  const res = await fetch(vendorUrl, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`下载融图结果失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";
  return uploadCanvasUserBuffer({ userId, buf, ext, contentType });
}

async function lookupSceneLibraryEntry(
  userId: string,
  entryId: string,
): Promise<{ name: string; visualPrompt: string } | null> {
  const db = await getSceneLibraryEntry(entryId);
  if (db?.visualPrompt?.trim()) {
    return { name: db.name, visualPrompt: db.visualPrompt.trim() };
  }
  const catalog = await readSceneLibraryCatalogForUser(userId);
  const fromCatalog = catalog.scenes.find((s) => s.id === entryId);
  if (fromCatalog?.visualPrompt?.trim()) {
    return { name: fromCatalog.name, visualPrompt: fromCatalog.visualPrompt.trim() };
  }
  return null;
}

export async function resolveOutfitSceneFusionFragment(opts: {
  userId: string;
  mode: OutfitSceneFusionMode;
  scene: SceneShot;
  libraryEntryId?: string;
}): Promise<{ fragment: string; libraryEntryName?: string }> {
  if (opts.mode === "follow_reference") {
    const fragment = buildOutfitFollowReferenceSceneFragment(opts.scene);
    if (!fragment) {
      throw new Error("该镜缺少光影/场景描述，请选手动场景或上传场景参考图");
    }
    return { fragment };
  }

  if (opts.mode === "library") {
    const entryId = opts.libraryEntryId?.trim();
    if (!entryId) throw new Error("请选择场景库条目");
    const entry = await lookupSceneLibraryEntry(opts.userId, entryId);
    if (!entry) {
      throw new Error("场景库条目无效或已删除");
    }
    return {
      fragment: entry.visualPrompt,
      libraryEntryName: entry.name,
    };
  }

  return { fragment: "" };
}

async function invokeOutfitSceneFusion(opts: {
  userId: string;
  projectId: string;
  personImageUrl: string;
  sceneRefUrl?: string;
  prompt: string;
  fusionModelKey: string;
}): Promise<string> {
  const modelKey = resolveOutfitFusionModelKey(opts.fusionModelKey);
  const clientPage = ecomClientPage(opts.userId, opts.projectId, ECOM_OUTFIT_VIDEO_TOOL_KEY);

  const imageUrls = [opts.personImageUrl.trim()];
  if (opts.sceneRefUrl?.trim()) {
    imageUrls.push(opts.sceneRefUrl.trim());
  }

  const refs = await ensureStoryboardRefImagesForWan27({
    userId: opts.userId,
    urls: imageUrls,
  });

  const promptText = opts.prompt.trim();
  const negative = OUTFIT_SCENE_FUSION_NEGATIVE_PROMPT_ZH;

  if (isQwenImageEditModel(modelKey) || isQwenImage30ProModel(modelKey)) {
    const content: Array<{ text: string } | { image: string }> = [
      ...refs.map((url) => ({ image: url })),
      { text: promptText },
    ];
    const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
      kind: "multimodal-image-sync",
      model: modelKey,
      content,
      parameters: {
        size: "768*1344",
        n: 1,
        prompt_extend: isQwenImageEditModel(modelKey),
        watermark: false,
        negative_prompt: negative,
      },
      clientPage: `${clientPage}/scene-fusion`,
    });
    const vendorUrl = await pollFusionImage(opts.userId, taskId, logId);
    return persistFusionImage(opts.userId, vendorUrl);
  }

  const apiModel = resolveStoryboardDashscopeModel(modelKey);
  const wan26 = isWan26ImageModel(apiModel) || isWan26ImageModel(modelKey);
  const content: Array<{ text: string } | { image: string }> = wan26
    ? [{ text: promptText }, ...refs.map((url) => ({ image: url }))]
    : [...refs.map((url) => ({ image: url })), { text: promptText }];

  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "wan27-image",
    model: apiModel,
    content,
    size: resolveStoryboardWan27JobSize({
      wan26,
      refCount: refs.length,
      wan27Size: "768*1344",
    }),
    n: 1,
    contentOrder: wan26 ? "text-first" : "images-first",
    clientPage: `${clientPage}/scene-fusion-wan27`,
  });
  const vendorUrl = await pollFusionImage(opts.userId, taskId, logId);
  return persistFusionImage(opts.userId, vendorUrl);
}

export async function runOutfitVideoSceneFusion(opts: {
  userId: string;
  projectId: string;
  scene: SceneShot;
  refs: WorkflowRefs;
  fusion: OutfitSceneFusion;
  fusionModelKey?: string;
}): Promise<OutfitSceneFusion> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const mode = opts.fusion.mode;
  if (!mode) throw new Error("请先选择场景来源");

  const personImageUrl = resolveOutfitDressedImageUrl(opts.refs);
  const modelKey = resolveOutfitFusionModelKey(
    opts.fusionModelKey ?? opts.fusion.fusionModelKey,
  );

  let fragment = opts.fusion.visualPromptFragment?.trim() ?? "";
  let libraryEntryName = opts.fusion.libraryEntryName;
  let libraryEntryId = opts.fusion.libraryEntryId;

  if (mode !== "upload_ref") {
    const resolved = await resolveOutfitSceneFusionFragment({
      userId: opts.userId,
      mode,
      scene: opts.scene,
      libraryEntryId,
    });
    fragment = resolved.fragment;
    libraryEntryName = resolved.libraryEntryName ?? libraryEntryName;
  } else if (!opts.fusion.sceneRefUrl?.trim()) {
    throw new Error("请先上传场景参考图");
  }

  const prompt = buildOutfitSceneFusionPositivePrompt(fragment);
  const fusedImageUrl = await invokeOutfitSceneFusion({
    userId: opts.userId,
    projectId: opts.projectId,
    personImageUrl,
    sceneRefUrl: mode === "upload_ref" ? opts.fusion.sceneRefUrl : undefined,
    prompt,
    fusionModelKey: modelKey,
  });

  return {
    ...opts.fusion,
    mode,
    libraryEntryId,
    libraryEntryName,
    visualPromptFragment: fragment || undefined,
    fusedImageUrl,
    fusionModelKey: modelKey,
    status: "success",
    failReason: undefined,
    sharedFromShotIndex: undefined,
  };
}

export function resolveOutfitShotKlingCharacterImage(
  scene: SceneShot,
  refs: WorkflowRefs,
): string {
  const fused = scene.sceneFusion?.fusedImageUrl?.trim();
  if (fused) return fused;
  return resolveOutfitDressedImageUrl(refs);
}
