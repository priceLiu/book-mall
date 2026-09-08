"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type { WorkflowRefs } from "@/lib/video-workflow/shot-spine";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import type { OutfitGarmentMode, OutfitRefMode } from "@/lib/video-workflow/templates/outfit-v1/ui-config";
import type {
  VtonGarmentItem,
  VtonGarmentKind,
  VtonLookSpec,
  VtonProjectMeta,
} from "@/lib/vton-types";
import { parseVtonProjectMeta } from "@/lib/vton-types";

export type ModelTryonSettings = {
  outfitRefMode?: OutfitRefMode;
  garmentMode?: OutfitGarmentMode;
  imageModelKey?: string;
  fusionModelKey?: string;
};

export type ModelTryonProject = {
  id: string;
  title: string | null;
  module: string;
  templateId: string;
  status: string;
  phase: string;
  settings: ModelTryonSettings;
  references: WorkflowRefs;
  meta: VtonProjectMeta | null;
  createdAt: string;
  updatedAt: string;
};

const BASE = "api/sso/tools/ecom/model-tryon";

function parseProject(raw: ModelTryonProject): ModelTryonProject {
  return {
    ...raw,
    meta: parseVtonProjectMeta(raw.meta),
  };
}

export async function fetchModelTryonModels(): Promise<{
  imageModels: StoryboardGatewayModel[];
  fusionModels: StoryboardGatewayModel[];
  defaults?: { image?: string; fusion?: string };
}> {
  const data = await ecomBookFetch(`${BASE}/models`);
  return {
    imageModels: (data.imageModels as StoryboardGatewayModel[]) ?? [],
    fusionModels: (data.fusionModels as StoryboardGatewayModel[]) ?? [],
    defaults: data.defaults as { image?: string; fusion?: string } | undefined,
  };
}

export async function createModelTryonProject(opts?: {
  title?: string;
}): Promise<ModelTryonProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return parseProject(data.project as ModelTryonProject);
}

export async function getModelTryonProject(id: string): Promise<ModelTryonProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, { cache: "no-store" });
  return parseProject(data.project as ModelTryonProject);
}

export async function listModelTryonProjectSummaries(): Promise<
  Array<{ id: string; title: string | null; updatedAt: string }>
> {
  const data = await ecomBookFetch(`${BASE}/projects`);
  const items = (data.items as ModelTryonProject[]) ?? [];
  return items.map((p) => ({
    id: p.id,
    title: p.title,
    updatedAt: p.updatedAt,
  }));
}

export async function updateModelTryonProject(
  id: string,
  patch: Partial<{ title: string; settings: ModelTryonSettings }>,
): Promise<ModelTryonProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return parseProject(data.project as ModelTryonProject);
}

export async function attachModelTryonRefs(
  projectId: string,
  refs: Partial<WorkflowRefs>,
): Promise<ModelTryonProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(refs),
  });
  return parseProject(data.project as ModelTryonProject);
}

export async function uploadModelTryonRefImage(
  projectId: string,
  role: "model" | "clothing" | "topGarment" | "bottomGarment",
  file: File,
): Promise<ModelTryonProject> {
  const form = new FormData();
  form.append("file", file);
  form.append("role", role);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs`, {
    method: "POST",
    body: form,
  });
  return parseProject(data.project as ModelTryonProject);
}

export async function uploadModelTryonGarment(
  projectId: string,
  kind: VtonGarmentKind,
  file: File,
): Promise<ModelTryonProject> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/garments`, {
    method: "POST",
    body: form,
  });
  return parseProject(data.project as ModelTryonProject);
}

export async function patchModelTryonGarments(
  projectId: string,
  body: {
    add?: Array<Omit<VtonGarmentItem, "id"> & { id?: string }>;
    removeIds?: string[];
  },
): Promise<ModelTryonProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/garments`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseProject(data.project as ModelTryonProject);
}

export async function patchModelTryonLooks(
  projectId: string,
  looks: VtonLookSpec[],
): Promise<ModelTryonProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/looks`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ looks }),
  });
  return parseProject(data.project as ModelTryonProject);
}

export async function buildModelTryonCartesianLooks(
  projectId: string,
  topIds: string[],
  bottomIds: string[],
): Promise<ModelTryonProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/looks`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cartesian: { topIds, bottomIds } }),
  });
  return parseProject(data.project as ModelTryonProject);
}

export async function batchModelTryon(
  projectId: string,
  opts?: { looks?: VtonLookSpec[] },
): Promise<ModelTryonProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/tryon/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return parseProject(data.project as ModelTryonProject);
}

export async function lockModelTryonResults(
  projectId: string,
  resultIds: string[],
): Promise<ModelTryonProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/locked-looks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resultIds }),
  });
  return parseProject(data.project as ModelTryonProject);
}

export async function setModelTryonDefaultLockedLook(
  projectId: string,
  lockedLookId: string,
): Promise<ModelTryonProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/locked-looks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ defaultLockedLookId: lockedLookId }),
  });
  return parseProject(data.project as ModelTryonProject);
}

export async function unlockModelTryonLockedLook(
  projectId: string,
  lookId: string,
): Promise<ModelTryonProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/locked-looks/${lookId}`, {
    method: "DELETE",
  });
  return parseProject(data.project as ModelTryonProject);
}

export async function generateModelTryonModel(
  projectId: string,
  opts: { prompt: string; modelKey?: string },
): Promise<ModelTryonProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs/generate-model`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return parseProject(data.project as ModelTryonProject);
}

export async function expandModelTryonFullBody(
  projectId: string,
  opts?: { prompt?: string; modelKey?: string },
): Promise<ModelTryonProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/refs/expand-full-body`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return parseProject(data.project as ModelTryonProject);
}

/** @deprecated 使用 batchModelTryon */
export async function tryModelTryon(projectId: string): Promise<ModelTryonProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/tryon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return parseProject(data.project as ModelTryonProject);
}

export async function saveModelTryonToAssets(
  projectId: string,
  opts?: { title?: string },
): Promise<{ assetId: string }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/save-to-assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return { assetId: data.assetId as string };
}
