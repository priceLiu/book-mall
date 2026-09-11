"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type { WorkflowEnvelope } from "@/lib/video-workflow/envelope";
import type { SceneShot, WorkflowRefs } from "@/lib/video-workflow/shot-spine";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import type { MediaDecomposeChatModel } from "@/lib/media-decompose-types";

import type { OutfitGarmentMode, OutfitRefMode } from "@/lib/video-workflow/templates/outfit-v1/ui-config";
import type {
  VtonGarmentItem,
  VtonGarmentKind,
  VtonLookSpec,
  VtonProjectMeta,
} from "@/lib/vton-types";
import { parseVtonProjectMeta } from "@/lib/vton-types";

export type OutfitVideoSettings = {
  videoModelKey?: string;
  splitModelKey?: string;
  fusionModelKey?: string;
  outfitRefMode?: OutfitRefMode;
  garmentMode?: OutfitGarmentMode;
  splitSystemPrompt?: string;
  splitUserPrompt?: string;
  lastSplitPrompt?: string;
  userSellPoint?: string;
};

export type OutfitClothAnalyseMeta = {
  structuredText: string;
  imageUrl: string;
  modelKey: string;
  analysedAt: string;
  status: "generating" | "success" | "failed" | "stale";
  failReason?: string;
};

export type OutfitProductionMeta = {
  status: "none" | "generating" | "ready" | "stale" | "partial_failed" | "failed";
  generatedAt?: string;
  failCount?: number;
  splitModelKey?: string;
};

export type OutfitVideoProject = {
  id: string;
  title: string | null;
  module: string;
  templateId: string;
  status: string;
  phase: string;
  settings: OutfitVideoSettings;
  references: WorkflowRefs;
  structured: Record<string, WorkflowEnvelope> | null;
  sceneList: SceneShot[];
  composeResult: {
    videoUrl: string;
    coverUrl?: string;
    videoInfo?: {
      durationSec: number;
      resolution: string;
      fps: number;
      aspectRatio: string;
    };
  } | null;
  meta: (VtonProjectMeta & Record<string, unknown>) | null;
  createdAt: string;
  updatedAt: string;
};

const BASE = "api/sso/tools/ecom/outfit-video";

function parseOutfitProject(raw: OutfitVideoProject): OutfitVideoProject {
  const metaRaw = raw.meta;
  const vton = parseVtonProjectMeta(metaRaw);
  const meta =
    metaRaw && typeof metaRaw === "object"
      ? ({ ...(metaRaw as Record<string, unknown>), ...vton } as OutfitVideoProject["meta"])
      : vton;
  return {
    ...raw,
    meta,
  };
}

export async function fetchOutfitVideoModels(): Promise<{
  videoModels: StoryboardGatewayModel[];
  chatModels: MediaDecomposeChatModel[];
  fusionModels: StoryboardGatewayModel[];
  imageModels?: StoryboardGatewayModel[];
  defaults?: { video?: string; split?: string; fusion?: string; image?: string };
}> {
  const data = await ecomBookFetch(`${BASE}/models`);
  return {
    videoModels: (data.videoModels as StoryboardGatewayModel[]) ?? [],
    chatModels: (data.chatModels as MediaDecomposeChatModel[]) ?? [],
    fusionModels: (data.fusionModels as StoryboardGatewayModel[]) ?? [],
    imageModels: (data.imageModels as StoryboardGatewayModel[]) ?? [],
    defaults: data.defaults as { video?: string; split?: string; fusion?: string; image?: string } | undefined,
  };
}

export async function createOutfitVideoProject(opts?: {
  title?: string;
}): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return parseOutfitProject(data.project as OutfitVideoProject);
}

export async function getOutfitVideoProject(id: string): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, { cache: "no-store" });
  return parseOutfitProject(data.project as OutfitVideoProject);
}

export async function uploadOutfitGarment(
  projectId: string,
  kind: VtonGarmentKind,
  file: File,
  opts?: { fullSetSlot?: "composite" | "top" | "bottom"; garmentId?: string },
): Promise<OutfitVideoProject> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  if (opts?.fullSetSlot) form.append("fullSetSlot", opts.fullSetSlot);
  if (opts?.garmentId) form.append("garmentId", opts.garmentId);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/garments`, {
    method: "POST",
    body: form,
  });
  return parseOutfitProject(data.project as OutfitVideoProject);
}

export async function patchOutfitGarments(
  projectId: string,
  body: {
    add?: Array<Omit<VtonGarmentItem, "id"> & { id?: string }>;
    removeIds?: string[];
    update?: Array<{ id: string; patch: Partial<VtonGarmentItem> }>;
  },
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/garments`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseOutfitProject(data.project as OutfitVideoProject);
}

export async function patchOutfitLooks(
  projectId: string,
  looks: VtonLookSpec[],
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/looks`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ looks }),
  });
  return parseOutfitProject(data.project as OutfitVideoProject);
}

export async function batchOutfitTryon(
  projectId: string,
  opts?: { looks?: VtonLookSpec[]; signal?: AbortSignal },
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/tryon/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ looks: opts?.looks }),
    signal: opts?.signal,
  });
  return parseOutfitProject(data.project as OutfitVideoProject);
}

export async function cancelOutfitTryonBatch(projectId: string): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/tryon/batch/cancel`, {
    method: "POST",
  });
  return parseOutfitProject(data.project as OutfitVideoProject);
}

export async function lockOutfitTryonResults(
  projectId: string,
  resultIds: string[],
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/locked-looks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resultIds }),
  });
  return parseOutfitProject(data.project as OutfitVideoProject);
}

export async function importOutfitLooks(
  projectId: string,
  opts: { sourceProjectId: string; resultIds?: string[]; lockedLookIds?: string[] },
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/import-looks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return parseOutfitProject(data.project as OutfitVideoProject);
}

export async function listOutfitVideoProjectSummaries(): Promise<
  Array<{ id: string; title: string | null; updatedAt: string; phase: string }>
> {
  const data = await ecomBookFetch(`${BASE}/projects`);
  const items = (data.items as OutfitVideoProject[]) ?? [];
  return items.map((p) => ({
    id: p.id,
    title: p.title,
    updatedAt: p.updatedAt,
    phase: p.phase,
  }));
}

export async function updateOutfitVideoProject(
  id: string,
  patch: Partial<{ title: string; settings: OutfitVideoSettings; meta: Record<string, unknown> }>,
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as OutfitVideoProject;
}

export async function uploadOutfitReferenceVideo(
  projectId: string,
  file: File,
): Promise<OutfitVideoProject> {
  const form = new FormData();
  form.append("file", file);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/media/upload`, {
    method: "POST",
    body: form,
  });
  return data.project as OutfitVideoProject;
}

export async function setOutfitReferenceVideoFromUrl(
  projectId: string,
  url: string,
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/media/from-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return data.project as OutfitVideoProject;
}

export async function attachOutfitReferenceVideoAsset(
  projectId: string,
  assetId: string,
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/media/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetId }),
  });
  return data.project as OutfitVideoProject;
}

export async function clearOutfitReferenceVideo(projectId: string): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/media`, {
    method: "DELETE",
  });
  return data.project as OutfitVideoProject;
}

export async function splitOutfitVideoScenes(
  projectId: string,
  opts?: { mock?: boolean; splitModelKey?: string; forceResplit?: boolean },
): Promise<{ project: OutfitVideoProject; envelope: WorkflowEnvelope }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/split-scene`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return {
    project: data.project as OutfitVideoProject,
    envelope: data.envelope as WorkflowEnvelope,
  };
}

export async function patchOutfitVideoScenes(
  projectId: string,
  sceneList: SceneShot[],
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/scenes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sceneList }),
  });
  return data.project as OutfitVideoProject;
}

export async function attachOutfitVideoRefs(
  projectId: string,
  refs: Partial<WorkflowRefs>,
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(refs),
  });
  return data.project as OutfitVideoProject;
}

export async function lockOutfitVideoRefs(projectId: string): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/lock-refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data.project as OutfitVideoProject;
}

export async function generateOutfitModel(
  projectId: string,
  opts: { prompt: string; modelKey?: string },
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs/generate-model`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return data.project as OutfitVideoProject;
}

export async function expandOutfitModelFullBody(
  projectId: string,
  opts?: { prompt?: string; modelKey?: string },
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs/expand-full-body`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as OutfitVideoProject;
}

export async function tryOutfitVideo(projectId: string): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/tryon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data.project as OutfitVideoProject;
}

export async function uploadOutfitVideoRefImage(
  projectId: string,
  role: "model" | "clothing" | "topGarment" | "bottomGarment",
  file: File,
): Promise<OutfitVideoProject> {
  const form = new FormData();
  form.append("file", file);
  form.append("role", role);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs`, {
    method: "POST",
    body: form,
  });
  return data.project as OutfitVideoProject;
}

export async function uploadOutfitVideoModelGallery(
  projectId: string,
  files: File[],
): Promise<OutfitVideoProject> {
  const form = new FormData();
  for (const file of files) form.append("file", file);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs/model-gallery`, {
    method: "POST",
    body: form,
  });
  return data.project as OutfitVideoProject;
}

export async function attachOutfitVideoModelGalleryAssets(
  projectId: string,
  assets: Array<{ ossUrl: string; title?: string }>,
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs/model-gallery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assets }),
  });
  return data.project as OutfitVideoProject;
}

export async function removeOutfitVideoModelGalleryItem(
  projectId: string,
  refId: string,
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs/model-gallery`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refId }),
  });
  return data.project as OutfitVideoProject;
}

export async function uploadOutfitVideoSceneRef(
  projectId: string,
  file: File,
): Promise<OutfitVideoProject> {
  const form = new FormData();
  form.append("file", file);
  form.append("role", "sceneRef");
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs`, {
    method: "POST",
    body: form,
  });
  return data.project as OutfitVideoProject;
}

export async function attachOutfitVideoSceneRefAsset(
  projectId: string,
  asset: { ossUrl: string; title?: string },
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sceneRef: {
        ossUrl: asset.ossUrl,
        label: asset.title ?? "场景参考",
        source: "asset",
      },
    }),
  });
  return data.project as OutfitVideoProject;
}

export async function clearOutfitVideoSceneRef(projectId: string): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sceneRef: null }),
  });
  return data.project as OutfitVideoProject;
}

export async function setOutfitVideoSceneLibraryPreset(
  projectId: string,
  preset: {
    entryId: string;
    entryName: string;
    visualPromptFragment: string;
  },
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sceneLibraryPreset: preset }),
  });
  return data.project as OutfitVideoProject;
}

export async function generateOutfitVideoShot(
  projectId: string,
  index: number,
  opts?: { mock?: boolean; videoModelKey?: string },
): Promise<{ project: OutfitVideoProject; envelope: WorkflowEnvelope }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/shots/${index}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return {
    project: data.project as OutfitVideoProject,
    envelope: data.envelope as WorkflowEnvelope,
  };
}

export async function batchGenerateOutfitVideoShots(
  projectId: string,
  indices: number[],
  opts?: { mock?: boolean; videoModelKey?: string; scenePrompts?: Record<string, string> },
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/shots/batch-generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ indices, ...opts }),
  });
  return data.project as OutfitVideoProject;
}

export async function renderOutfitVideo(
  projectId: string,
  opts?: { sceneIndexes?: number[] },
): Promise<{
  jobId: string;
  expiresAt: string;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts?.sceneIndexes?.length ? { sceneIndexes: opts.sceneIndexes } : {}),
  });
  return { jobId: data.jobId as string, expiresAt: data.expiresAt as string };
}

export async function pollOutfitVideoRender(projectId: string): Promise<{
  status: string;
  jobId?: string;
  progress?: number;
  progressLabel?: string;
  outputUrl?: string;
  failMessage?: string;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/render`);
  return data as {
    status: string;
    jobId?: string;
    progress?: number;
    progressLabel?: string;
    outputUrl?: string;
    failMessage?: string;
  };
}

export async function saveOutfitVideoDeliverableSnapshot(
  projectId: string,
  workName: string,
): Promise<{ title: string; snapshot?: import("@/lib/outfit-video-deliverable-dirty").OutfitVideoDeliverableSnapshot }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/deliverable/snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workName }),
  });
  return {
    title: data.title as string,
    snapshot: data.snapshot as
      | import("@/lib/outfit-video-deliverable-dirty").OutfitVideoDeliverableSnapshot
      | undefined,
  };
}

export type OutfitSceneFusionMode = "follow_reference" | "library" | "upload_ref";

export async function fuseOutfitShotScene(
  projectId: string,
  sceneIndex: number,
  opts: {
    mode: OutfitSceneFusionMode;
    libraryEntryId?: string;
    sceneRefUrl?: string;
    fusionModelKey?: string;
  },
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/shots/${sceneIndex}/scene-fusion`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    },
  );
  return data.project as OutfitVideoProject;
}

export async function applyOutfitSceneFusionToAll(
  projectId: string,
  sourceIndex: number,
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/shots/${sourceIndex}/scene-fusion`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "apply_all", sourceIndex }),
    },
  );
  return data.project as OutfitVideoProject;
}

export async function uploadOutfitSceneRefImage(
  projectId: string,
  sceneIndex: number,
  file: File,
): Promise<OutfitVideoProject> {
  const form = new FormData();
  form.append("file", file);
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/shots/${sceneIndex}/scene-fusion`,
    { method: "POST", body: form },
  );
  return data.project as OutfitVideoProject;
}

export async function patchOutfitShotSceneFusionConfig(
  projectId: string,
  sceneIndex: number,
  fusion: Record<string, unknown>,
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/shots/${sceneIndex}/scene-fusion`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configOnly: true, fusion }),
    },
  );
  return data.project as OutfitVideoProject;
}

export function parseOutfitClothAnalyseMeta(
  meta: OutfitVideoProject["meta"],
): OutfitClothAnalyseMeta | null {
  const raw = meta?.outfitClothAnalyse;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const structuredText = typeof o.structuredText === "string" ? o.structuredText.trim() : "";
  const imageUrl = typeof o.imageUrl === "string" ? o.imageUrl.trim() : "";
  const modelKey = typeof o.modelKey === "string" ? o.modelKey.trim() : "";
  const analysedAt = typeof o.analysedAt === "string" ? o.analysedAt : "";
  const status = o.status;
  if (
    !imageUrl ||
    !analysedAt ||
    (status !== "generating" &&
      status !== "success" &&
      status !== "failed" &&
      status !== "stale")
  ) {
    return null;
  }
  if (status === "stale") {
    return {
      structuredText,
      imageUrl,
      modelKey,
      analysedAt,
      status: "stale",
      failReason:
        typeof o.failReason === "string"
          ? o.failReason
          : "参考图已变更，请重新识别服装",
    };
  }
  if (!modelKey) return null;
  return {
    structuredText,
    imageUrl,
    modelKey,
    analysedAt,
    status,
    failReason: typeof o.failReason === "string" ? o.failReason : undefined,
  };
}

export async function analyseOutfitVideoCloth(projectId: string): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/cloth-analyse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return parseOutfitProject(data.project as OutfitVideoProject);
}

export async function adaptOutfitVideoSceneStoryboard(
  projectId: string,
  sceneIndex: number,
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/shots/${sceneIndex}/adapt-storyboard`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  return parseOutfitProject(data.project as OutfitVideoProject);
}

export function parseOutfitProductionMeta(
  meta: OutfitVideoProject["meta"],
): OutfitProductionMeta | null {
  const raw = meta?.outfitProductionMeta;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = o.status;
  if (
    status !== "none" &&
    status !== "generating" &&
    status !== "ready" &&
    status !== "stale" &&
    status !== "partial_failed" &&
    status !== "failed"
  ) {
    return null;
  }
  return {
    status,
    generatedAt: typeof o.generatedAt === "string" ? o.generatedAt : undefined,
    failCount: typeof o.failCount === "number" ? o.failCount : undefined,
    splitModelKey: typeof o.splitModelKey === "string" ? o.splitModelKey : undefined,
  };
}

export async function generateOutfitVideoProductionStoryboard(
  projectId: string,
): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/generate-production-storyboard`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  return parseOutfitProject(data.project as OutfitVideoProject);
}
