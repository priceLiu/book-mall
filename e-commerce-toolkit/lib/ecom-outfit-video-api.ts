"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type { WorkflowEnvelope } from "@/lib/video-workflow/envelope";
import type { SceneShot, WorkflowRefs } from "@/lib/video-workflow/shot-spine";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import type { MediaDecomposeChatModel } from "@/lib/media-decompose-types";

import type { OutfitGarmentMode, OutfitRefMode } from "@/lib/video-workflow/templates/outfit-v1/ui-config";

export type OutfitVideoSettings = {
  videoModelKey?: string;
  splitModelKey?: string;
  fusionModelKey?: string;
  outfitRefMode?: OutfitRefMode;
  garmentMode?: OutfitGarmentMode;
  splitSystemPrompt?: string;
  splitUserPrompt?: string;
  lastSplitPrompt?: string;
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
  meta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

const BASE = "api/sso/tools/ecom/outfit-video";

export async function fetchOutfitVideoModels(): Promise<{
  videoModels: StoryboardGatewayModel[];
  chatModels: MediaDecomposeChatModel[];
  fusionModels: StoryboardGatewayModel[];
  defaults?: { video?: string; split?: string; fusion?: string };
}> {
  const data = await ecomBookFetch(`${BASE}/models`);
  return {
    videoModels: (data.videoModels as StoryboardGatewayModel[]) ?? [],
    chatModels: (data.chatModels as MediaDecomposeChatModel[]) ?? [],
    fusionModels: (data.fusionModels as StoryboardGatewayModel[]) ?? [],
    defaults: data.defaults as { video?: string; split?: string; fusion?: string } | undefined,
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
  return data.project as OutfitVideoProject;
}

export async function getOutfitVideoProject(id: string): Promise<OutfitVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, { cache: "no-store" });
  return data.project as OutfitVideoProject;
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

export async function renderOutfitVideo(projectId: string): Promise<{
  jobId: string;
  expiresAt: string;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
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
): Promise<{ title: string }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/deliverable/snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workName }),
  });
  return { title: data.title as string };
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
