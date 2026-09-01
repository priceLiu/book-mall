"use client";

import { EcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  MediaDecomposeChatModel,
  MediaDecomposeProject,
  MediaDecomposeSettings,
} from "@/lib/media-decompose-types";
import type { SeedVideoProject } from "@/lib/seed-video-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const BASE = "api/sso/tools/ecom/media-decompose";

export async function fetchMediaDecomposeModels(): Promise<{
  chatModels: MediaDecomposeChatModel[];
  imageModels?: StoryboardGatewayModel[];
  defaults?: { chat?: string; image?: string };
}> {
  const data = await ecomBookFetch(`${BASE}/models`);
  return {
    chatModels: (data.chatModels as MediaDecomposeChatModel[]) ?? [],
    imageModels: (data.imageModels as StoryboardGatewayModel[]) ?? [],
    defaults: data.defaults as { chat?: string; image?: string } | undefined,
  };
}

export async function listMediaDecomposeProjectSummaries(): Promise<
  Array<{ id: string; title: string | null; updatedAt: string; mediaKind: string | null }>
> {
  const data = await ecomBookFetch(`${BASE}/projects`);
  const items = (data.items as MediaDecomposeProject[]) ?? [];
  return items.map((p) => ({
    id: p.id,
    title: p.title,
    updatedAt: p.updatedAt,
    mediaKind: p.media?.kind ?? null,
  }));
}

export async function createMediaDecomposeProject(opts?: {
  title?: string;
}): Promise<MediaDecomposeProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as MediaDecomposeProject;
}

export async function getMediaDecomposeProject(id: string): Promise<MediaDecomposeProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as MediaDecomposeProject;
}

export async function deleteMediaDecomposeProject(id: string): Promise<void> {
  await ecomBookFetch(`${BASE}/projects/${id}`, { method: "DELETE" });
}

export async function updateMediaDecomposeProject(
  id: string,
  patch: Partial<{
    title: string;
    settings: MediaDecomposeSettings;
    meta: Record<string, unknown> | null;
  }>,
): Promise<MediaDecomposeProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as MediaDecomposeProject;
}

export async function uploadMediaDecomposeFile(
  projectId: string,
  file: File,
): Promise<MediaDecomposeProject> {
  const form = new FormData();
  form.set("file", file);
  const res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/media/upload`, {
    method: "POST",
    body: form,
  });
  if (res.status === 401) throw new EcomUnauthorizedError();
  const data = (await res.json()) as { project?: MediaDecomposeProject; error?: string };
  if (!res.ok) throw new Error(data.error ?? "上传失败");
  return data.project!;
}

export async function setMediaDecomposeFromUrl(
  projectId: string,
  url: string,
): Promise<MediaDecomposeProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/media/from-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return data.project as MediaDecomposeProject;
}

export async function attachMediaDecomposeAsset(
  projectId: string,
  assetId: string,
): Promise<MediaDecomposeProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/media/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetId }),
  });
  return data.project as MediaDecomposeProject;
}

export async function clearMediaDecomposeMedia(projectId: string): Promise<MediaDecomposeProject> {
  const res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/media`, {
    method: "DELETE",
  });
  if (res.status === 401) throw new EcomUnauthorizedError();
  const data = (await res.json()) as { project?: MediaDecomposeProject; error?: string };
  if (!res.ok) throw new Error(data.error ?? "清除失败");
  return data.project!;
}

export async function streamMediaDecompose(
  projectId: string,
  args: { prompt: string; modelKey: string },
  onChunk: (text: string) => void,
): Promise<string> {
  const res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/decompose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (res.status === 401) throw new EcomUnauthorizedError();
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `拆解失败 (${res.status})`);
  }
  if (!res.body) throw new Error("无响应体");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const piece = decoder.decode(value, { stream: true });
    full += piece;
    onChunk(full);
  }
  return full.trim();
}

/** Dev only · Mock 拆解（不调 Gateway，写入 fixture 结果） */
export async function mockMediaDecompose(
  projectId: string,
  args?: { prompt?: string },
): Promise<MediaDecomposeProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/decompose/mock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args ?? {}),
  });
  return data.project as MediaDecomposeProject;
}

export async function startMediaDecomposeReplica(projectId: string): Promise<{
  project: MediaDecomposeProject;
  seedVideo: SeedVideoProject;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replica`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return {
    project: data.project as MediaDecomposeProject,
    seedVideo: data.seedVideo as SeedVideoProject,
  };
}

export async function getMediaDecomposeReplica(projectId: string): Promise<{
  project: MediaDecomposeProject;
  seedVideo: SeedVideoProject | null;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replica`);
  return {
    project: data.project as MediaDecomposeProject,
    seedVideo: (data.seedVideo as SeedVideoProject | null) ?? null,
  };
}

export async function uploadMediaDecomposeReplicaRef(
  projectId: string,
  role: "model" | "product",
  file: File,
): Promise<{
  project: MediaDecomposeProject;
  seedVideo: SeedVideoProject;
}> {
  const form = new FormData();
  form.set("role", role);
  form.set("file", file);
  const res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/replica/refs`, {
    method: "POST",
    body: form,
  });
  if (res.status === 401) throw new EcomUnauthorizedError();
  const data = (await res.json()) as {
    project?: MediaDecomposeProject;
    seedVideo?: SeedVideoProject;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "上传失败");
  return { project: data.project!, seedVideo: data.seedVideo! };
}

export async function attachMediaDecomposeReplicaModelFromLibrary(
  projectId: string,
  entry: { id: string; name: string; ossUrl: string },
): Promise<{
  project: MediaDecomposeProject;
  seedVideo: SeedVideoProject;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replica/refs/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelEntry: entry }),
  });
  return {
    project: data.project as MediaDecomposeProject,
    seedVideo: data.seedVideo as SeedVideoProject,
  };
}

export async function attachMediaDecomposeReplicaRefsFromAssets(
  projectId: string,
  role: "model" | "product",
  assetIds: string[],
): Promise<{
  project: MediaDecomposeProject;
  seedVideo: SeedVideoProject;
  addedCount: number;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replica/refs/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, assetIds }),
  });
  return {
    project: data.project as MediaDecomposeProject,
    seedVideo: data.seedVideo as SeedVideoProject,
    addedCount: Number(data.addedCount ?? 0),
  };
}

export async function removeMediaDecomposeReplicaRef(
  projectId: string,
  refId: string,
): Promise<{
  project: MediaDecomposeProject;
  seedVideo: SeedVideoProject;
}> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/replica/refs/${encodeURIComponent(refId)}`,
    { method: "DELETE" },
  );
  return {
    project: data.project as MediaDecomposeProject,
    seedVideo: data.seedVideo as SeedVideoProject,
  };
}

export async function recognizeMediaDecomposeReplicaProduct(
  projectId: string,
  opts?: { userDraft?: string },
): Promise<{
  project: MediaDecomposeProject;
  seedVideo: SeedVideoProject;
  productBrief: string;
}> {
  const body: { userDraft?: string } = {};
  if (opts?.userDraft?.trim()) body.userDraft = opts.userDraft.trim();
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replica/recognize-product`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    project: data.project as MediaDecomposeProject,
    seedVideo: data.seedVideo as SeedVideoProject,
    productBrief: String(data.productBrief ?? ""),
  };
}

/** Dev only · Mock 识产品 */
export async function mockMediaDecomposeReplicaRecognizeProduct(
  projectId: string,
): Promise<{
  project: MediaDecomposeProject;
  seedVideo: SeedVideoProject;
  productBrief: string;
}> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/replica/recognize-product/mock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  return {
    project: data.project as MediaDecomposeProject,
    seedVideo: data.seedVideo as SeedVideoProject,
    productBrief: String(data.productBrief ?? ""),
  };
}

export async function generateMediaDecomposeReplicaScript(
  projectId: string,
  opts?: { productBrief?: string; modelKey?: string },
): Promise<{
  project: MediaDecomposeProject;
  seedVideo: SeedVideoProject;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replica/generate-script`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return {
    project: data.project as MediaDecomposeProject,
    seedVideo: data.seedVideo as SeedVideoProject,
  };
}

export async function generateMediaDecomposeReplicaModelPrompt(
  projectId: string,
  modelKey?: string,
): Promise<{ prompt: string }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replica/model-prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(modelKey ? { modelKey } : {}),
  });
  return { prompt: String(data.prompt ?? "") };
}

export async function generateMediaDecomposeReplicaModelImage(
  projectId: string,
  opts: { prompt: string; modelKey: string; imageSize?: string },
): Promise<{
  project: MediaDecomposeProject;
  seedVideo: SeedVideoProject;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/replica/model/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return {
    project: data.project as MediaDecomposeProject,
    seedVideo: data.seedVideo as SeedVideoProject,
  };
}

export async function saveMediaDecomposeDeliverableSnapshot(
  projectId: string,
  workName: string,
): Promise<{ snapshot: { savedAt: string; title: string }; project: MediaDecomposeProject }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/deliverable/snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workName }),
  });
  return data as {
    snapshot: { savedAt: string; title: string };
    project: MediaDecomposeProject;
  };
}

export async function reuseMediaDecomposeProject(
  projectId: string,
  savedAt?: string,
): Promise<MediaDecomposeProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/reuse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(savedAt ? { savedAt } : {}),
  });
  return data.project as MediaDecomposeProject;
}

/** 下载 ZIP 交付包（源素材 + 拆解结果 + 可选复刻镜头/成片） */
export async function downloadMediaDecomposeExportZip(projectId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/export`, {
      method: "GET",
      credentials: "include",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg === "fetch failed" ? "与服务器连接中断，请稍后重试。" : msg);
  }
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    let message = `导出失败 (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (typeof data.error === "string") message = data.error;
    } catch {
      /* 非 JSON */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;\s]+)/i);
  const plainMatch = disposition.match(/filename="([^"]+)"/i);
  const filename = utf8Match
    ? decodeURIComponent(utf8Match[1]!)
    : plainMatch
      ? plainMatch[1]!
      : "拆图拆视频-交付包.zip";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
