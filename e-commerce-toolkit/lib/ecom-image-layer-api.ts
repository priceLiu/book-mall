import { EcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  ImageLayerProject,
  ImageLayerStack,
  ImageLayerWorkspace,
} from "@/lib/image-layer-types";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";

const BASE = "api/sso/tools/ecom/image-layer";

export async function uploadImageLayerSource(
  file: File,
  projectId?: string,
): Promise<{ ossUrl: string }> {
  const form = new FormData();
  form.set("file", file);
  if (projectId?.trim()) form.set("projectId", projectId.trim());

  const res = await fetch(`/api/book-mall/${BASE}/upload`, {
    method: "POST",
    body: form,
  });
  if (res.status === 401) throw new EcomUnauthorizedError();
  const data = (await res.json()) as { ossUrl?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "上传失败");
  const ossUrl = typeof data.ossUrl === "string" ? data.ossUrl : "";
  if (!ossUrl) throw new Error("上传未返回 ossUrl");
  return { ossUrl };
}

export async function decomposeImageLayers(opts: {
  sourceImageUrl: string;
  bboxes?: Array<[number, number, number, number]>;
  size?: string;
  projectId?: string;
}): Promise<ImageLayerStack> {
  const data = await ecomBookFetch(`${BASE}/decompose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const stack = data.stack as ImageLayerStack | undefined;
  if (!stack?.background?.url) throw new Error("图层拆分未返回有效结果");
  return stack;
}

export async function editImageLayer(opts: {
  compositeImageUrl: string;
  bbox: [number, number, number, number];
  prompt: string;
  size?: string;
  projectId?: string;
}): Promise<ImageLayerStack> {
  const data = await ecomBookFetch(`${BASE}/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const stack = data.stack as ImageLayerStack | undefined;
  if (!stack?.background?.url) throw new Error("图层编辑未返回有效结果");
  return stack;
}

export async function listImageLayerProjectSummaries(): Promise<EcomProjectListItem[]> {
  const data = await ecomBookFetch(`${BASE}/projects`);
  const items = (data.items as ImageLayerProject[]) ?? [];
  return items.map((p) => ({
    id: p.id,
    title: p.title?.trim() || "图片分层",
    updatedAt: p.updatedAt,
    subtitle: p.workspace?.stack ? `已拆分 ${p.workspace.stack.layers.length} 层` : null,
    thumbnailUrl: p.workspace?.sourceImageUrl ?? p.workspace?.stack?.background?.url ?? null,
  }));
}

export async function createImageLayerProject(opts?: {
  title?: string;
}): Promise<ImageLayerProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as ImageLayerProject;
}

export async function getImageLayerProject(id: string): Promise<ImageLayerProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as ImageLayerProject;
}

export async function saveImageLayerWorkspace(
  id: string,
  workspace: ImageLayerWorkspace,
): Promise<ImageLayerProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace }),
  });
  return data.project as ImageLayerProject;
}

export async function updateImageLayerProject(
  id: string,
  patch: Partial<{ title: string; meta: Record<string, unknown> }>,
): Promise<ImageLayerProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as ImageLayerProject;
}

export async function deleteImageLayerProject(id: string): Promise<void> {
  await ecomBookFetch(`${BASE}/projects/${id}`, { method: "DELETE" });
}
