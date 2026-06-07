"use client";

import { EcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  StoryboardChatMessage,
  StoryboardGatewayModel,
  StoryboardProject,
  StoryboardReference,
  StoryboardSheet,
} from "@/lib/storyboard-types";

export async function fetchStoryboardModels(): Promise<{
  chatModels: StoryboardGatewayModel[];
  imageModels: StoryboardGatewayModel[];
  videoModels: StoryboardGatewayModel[];
}> {
  const data = await ecomBookFetch("api/sso/tools/ecom/storyboard/models");
  return {
    chatModels: (data.chatModels as StoryboardGatewayModel[]) ?? [],
    imageModels: (data.imageModels as StoryboardGatewayModel[]) ?? [],
    videoModels: (data.videoModels as StoryboardGatewayModel[]) ?? [],
  };
}

export async function listStoryboardProjects(): Promise<StoryboardProject[]> {
  const data = await ecomBookFetch("api/sso/tools/ecom/storyboard/projects");
  return (data.items as StoryboardProject[]) ?? [];
}

export async function createStoryboardProject(opts?: {
  title?: string;
  brief?: Record<string, unknown>;
}): Promise<StoryboardProject> {
  const data = await ecomBookFetch("api/sso/tools/ecom/storyboard/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as StoryboardProject;
}

export async function getStoryboardProject(id: string): Promise<StoryboardProject> {
  const data = await ecomBookFetch(`api/sso/tools/ecom/storyboard/projects/${id}`);
  return data.project as StoryboardProject;
}

export async function updateStoryboardProject(
  id: string,
  patch: Partial<{
    title: string;
    brief: Record<string, unknown>;
    settings: Record<string, unknown>;
    references: StoryboardReference[];
    chatHistory: StoryboardChatMessage[];
    sheet: StoryboardSheet | null;
    sheetPngUrl: string | null;
    status: string;
    meta: StoryboardProject["meta"];
  }>,
): Promise<StoryboardProject> {
  const data = await ecomBookFetch(`api/sso/tools/ecom/storyboard/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as StoryboardProject;
}

export async function deleteStoryboardProject(id: string): Promise<void> {
  await ecomBookFetch(`api/sso/tools/ecom/storyboard/projects/${id}`, {
    method: "DELETE",
  });
}

export async function removeStoryboardRef(
  projectId: string,
  refId: string,
): Promise<StoryboardProject> {
  const project = await getStoryboardProject(projectId);
  return updateStoryboardProject(projectId, {
    references: project.references.filter((r) => r.id !== refId),
  });
}

export async function uploadStoryboardRef(
  projectId: string,
  file: File,
  opts: { label: string; role: StoryboardReference["role"] },
): Promise<StoryboardReference> {
  const form = new FormData();
  form.append("file", file);
  form.append("label", opts.label);
  form.append("role", opts.role);
  const data = await ecomBookFetch(
    `api/sso/tools/ecom/storyboard/projects/${projectId}/upload`,
    { method: "POST", body: form },
  );
  return data.reference as StoryboardReference;
}

export async function streamStoryboardChat(opts: {
  projectId: string;
  messages: StoryboardChatMessage[];
  modelKey: string;
  onChunk: (text: string) => void;
}): Promise<string> {
  const res = await fetch(
    `/api/book-mall/api/sso/tools/ecom/storyboard/projects/${opts.projectId}/assistant/chat`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
        modelKey: opts.modelKey,
      }),
    },
  );
  if (res.status === 401) {
    throw new EcomUnauthorizedError("未登录");
  }
  if (!res.ok) {
    const text = await res.text();
    let err = `请求失败 (${res.status})`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) err = j.error;
    } catch {
      /* */
    }
    throw new Error(err);
  }
  if (!res.body) throw new Error("无响应流");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const piece = decoder.decode(value, { stream: true });
    full += piece;
    opts.onChunk(full);
  }
  return full;
}

export async function uploadStoryboardSheetPng(
  projectId: string,
  pngBase64: string,
): Promise<string> {
  const data = await ecomBookFetch(
    `api/sso/tools/ecom/storyboard/projects/${projectId}/sheet/png`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pngBase64 }),
    },
  );
  return data.sheetPngUrl as string;
}

export async function exportStoryboardHtml(projectId: string): Promise<{
  html: string;
  sheetHtmlUrl: string;
}> {
  const data = await ecomBookFetch(
    `api/sso/tools/ecom/storyboard/projects/${projectId}/sheet/html`,
  );
  return {
    html: data.html as string,
    sheetHtmlUrl: data.sheetHtmlUrl as string,
  };
}

export function downloadStoryboardHtml(projectId: string): void {
  window.open(
    `/api/book-mall/api/sso/tools/ecom/storyboard/projects/${projectId}/sheet/html?download=1`,
    "_blank",
  );
}

export async function syncStoryboardSheet(
  projectId: string,
  opts?: { schemeIndex?: number },
): Promise<StoryboardProject> {
  const data = await ecomBookFetch(
    `api/sso/tools/ecom/storyboard/projects/${projectId}/sheet/sync`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts ?? {}),
    },
  );
  return data.project as StoryboardProject;
}

export async function generateStoryboardSheetImage(
  projectId: string,
  opts: {
    modelKey: string;
    aspectRatio?: "16:9" | "9:16";
    imageSize?: string;
    autoGenCharacter?: boolean;
    panelIndex?: number;
  },
): Promise<{
  sheet: StoryboardSheet;
  references?: StoryboardReference[];
  chargePoints?: number;
}> {
  let res: Response;
  try {
    res = await fetch(
      `/api/book-mall/api/sso/tools/ecom/storyboard/projects/${projectId}/sheet/image/generate`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      msg === "fetch failed"
        ? "与服务器连接中断（全部分镜图生成约需 1–2 分钟）。请刷新页面查看是否已部分生成，或改为单镜重试。"
        : msg,
    );
  }
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* */
  }
  if (!res.ok) {
    const err =
      typeof data.error === "string" ? data.error : `请求失败 (${res.status})`;
    throw new Error(err);
  }
  return {
    sheet: data.sheet as StoryboardSheet,
    references: Array.isArray(data.references)
      ? (data.references as StoryboardReference[])
      : undefined,
    chargePoints:
      typeof data.chargePoints === "number" ? data.chargePoints : undefined,
  };
}

export type StoryboardFullVideoPollResult =
  | { status: "idle" }
  | {
      status: "running";
      taskId: string;
      startedAt: string;
      modelKey?: string;
    }
  | {
      status: "succeeded";
      asset: { id: string; ossUrl: string };
      videoOssUrl: string;
      taskId: string;
      chargePoints?: number | null;
    };

export async function submitStoryboardFullVideo(
  projectId: string,
  opts: {
    durationSec: number;
    aspectRatio?: "16:9" | "9:16" | "1:1";
    resolution?: string;
    modelKey?: string;
    ratio?: string;
    seedStr?: string;
    promptExtend?: boolean;
  },
): Promise<{
  status: "running";
  taskId: string;
  startedAt: string;
  reused?: boolean;
}> {
  const data = await ecomBookFetch(
    `api/sso/tools/ecom/storyboard/projects/${projectId}/video/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    },
  );
  return {
    status: "running",
    taskId: data.taskId as string,
    startedAt: (data.startedAt as string) ?? new Date().toISOString(),
    reused: data.reused === true,
  };
}

export async function pollStoryboardFullVideoStatus(
  projectId: string,
): Promise<StoryboardFullVideoPollResult> {
  const data = await ecomBookFetch(
    `api/sso/tools/ecom/storyboard/projects/${projectId}/video/generate/status`,
    { method: "GET" },
  );
  return data as StoryboardFullVideoPollResult;
}

/** @deprecated 使用 submitStoryboardFullVideo + pollStoryboardFullVideoStatus */
export async function generateStoryboardVideo(
  projectId: string,
  opts: {
    durationSec: number;
    aspectRatio?: "16:9" | "9:16";
    resolution?: string;
    modelKey?: string;
  },
): Promise<{ assetId: string; chargePoints?: number }> {
  await submitStoryboardFullVideo(projectId, opts);
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const polled = await pollStoryboardFullVideoStatus(projectId);
    if (polled.status === "succeeded") {
      return {
        assetId: polled.asset.id,
        chargePoints:
          typeof polled.chargePoints === "number" ? polled.chargePoints : undefined,
      };
    }
    if (polled.status === "idle") break;
  }
  throw new Error("视频生成超时");
}

export async function generateStoryboardPanelVideo(
  projectId: string,
  opts: {
    panelIndex: number;
    aspectRatio?: "16:9" | "9:16";
    durationSec?: number;
    resolution?: string;
    modelKey?: string;
  },
): Promise<{ videoUrl: string; panelIndex: number; chargePoints?: number }> {
  const data = await ecomBookFetch(
    `api/sso/tools/ecom/storyboard/projects/${projectId}/video/panel/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    },
  );
  return {
    videoUrl: data.videoUrl as string,
    panelIndex: data.panelIndex as number,
    chargePoints:
      typeof data.chargePoints === "number" ? data.chargePoints : undefined,
  };
}

export async function saveStoryboardDeliverableSnapshot(
  projectId: string,
  opts?: { videoMode?: "full_sheet" | "merged_panels" },
): Promise<{ snapshot: unknown; project: StoryboardProject }> {
  const data = await ecomBookFetch(
    `api/sso/tools/ecom/storyboard/projects/${projectId}/deliverable/snapshot`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts ?? {}),
    },
  );
  return {
    snapshot: data.snapshot,
    project: data.project as StoryboardProject,
  };
}

export async function mergeStoryboardPanelVideos(
  projectId: string,
): Promise<{ assetId: string; ossUrl: string }> {
  const data = await ecomBookFetch(
    `api/sso/tools/ecom/storyboard/projects/${projectId}/video/merge`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  const asset = data.asset as { id: string };
  return { assetId: asset.id, ossUrl: data.ossUrl as string };
}
