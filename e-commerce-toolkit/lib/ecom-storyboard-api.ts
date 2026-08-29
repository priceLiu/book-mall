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

const MODELS_CACHE_KEY = "ecom-storyboard-models-cache";
const MODELS_CACHE_MS = 5 * 60 * 1000;

type StoryboardModelsPayload = {
  chatModels: StoryboardGatewayModel[];
  imageModels: StoryboardGatewayModel[];
  videoModels: StoryboardGatewayModel[];
};

export async function fetchStoryboardModels(): Promise<StoryboardModelsPayload> {
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(MODELS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { at?: number; data?: StoryboardModelsPayload };
        if (
          parsed.data &&
          typeof parsed.at === "number" &&
          Date.now() - parsed.at < MODELS_CACHE_MS
        ) {
          return parsed.data;
        }
      }
    } catch {
      /* ignore */
    }
  }

  const data = await ecomBookFetch("api/sso/tools/ecom/storyboard/models");
  const result: StoryboardModelsPayload = {
    chatModels: (data.chatModels as StoryboardGatewayModel[]) ?? [],
    imageModels: (data.imageModels as StoryboardGatewayModel[]) ?? [],
    videoModels: (data.videoModels as StoryboardGatewayModel[]) ?? [],
  };

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(
        MODELS_CACHE_KEY,
        JSON.stringify({ at: Date.now(), data: result }),
      );
    } catch {
      /* ignore */
    }
  }

  return result;
}

export async function listStoryboardProjects(): Promise<StoryboardProject[]> {
  const data = await ecomBookFetch("api/sso/tools/ecom/storyboard/projects");
  return (data.items as StoryboardProject[]) ?? [];
}

export async function listStoryboardProjectSummaries(): Promise<
  Array<{ id: string; title: string | null; updatedAt: string }>
> {
  const data = await ecomBookFetch(
    "api/sso/tools/ecom/storyboard/projects?summary=1",
  );
  return (data.items as Array<{ id: string; title: string | null; updatedAt: string }>) ?? [];
}

export async function createStoryboardProject(opts?: {
  title?: string;
  brief?: Record<string, unknown>;
  meta?: StoryboardProject["meta"];
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

/** 把「我的资产」里的图挂为参考图（服务端会按厂商像素区间归一化） */
export async function attachStoryboardRefsFromAssets(
  projectId: string,
  opts: { assetIds: string[]; role: StoryboardReference["role"] },
): Promise<StoryboardProject> {
  const data = await ecomBookFetch(
    `api/sso/tools/ecom/storyboard/projects/${projectId}/references/attach`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    },
  );
  return data.project as StoryboardProject;
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
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const piece = decoder.decode(value, { stream: true });
      full += piece;
      opts.onChunk(full);
    }
  } catch (readError) {
    const msg = readError instanceof Error ? readError.message : String(readError);
    if (/network error|failed to fetch|load failed|aborted|abort/i.test(msg)) {
      throw new Error(
        "助手流式连接中断（可能是生成内容过长或服务超时）。请稍后重试「重新生成分镜」；若仍失败请检查 Gateway 聊天模型是否可用。",
      );
    }
    throw readError instanceof Error ? readError : new Error(msg);
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
    characterOnly?: boolean;
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

/** 一键复用：打开已有项目或从历史快照创建新项目 */
export async function reuseStoryboardProject(
  projectId: string,
  savedAt?: string,
): Promise<StoryboardProject> {
  const data = await ecomBookFetch(
    `api/sso/tools/ecom/storyboard/projects/${projectId}/reuse`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(savedAt ? { savedAt } : {}),
    },
  );
  return data.project as StoryboardProject;
}

export type MediaRenderJobDto = {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "EXPIRED";
  progress: number;
  downloadUrl: string | null;
  expiresAt: string;
  errorMessage: string | null;
};

export type EcomMediaRenderProfileInput = {
  transition?: { type: "xfade"; durationSec: number } | { type: "none" };
  subtitle?: {
    mode?: "script" | "asr" | "none";
    burnIn?: boolean;
    style?: import("@private/media-render-subtitle-style/subtitle-style-options").SubtitleBurnInStyle;
  };
  video?: { scaleMode?: "source" | "fit720p" | "fit1080p" };
};

export async function renderStoryboardPanelVideos(
  projectId: string,
  opts?: { profile?: EcomMediaRenderProfileInput; panelIndexes?: number[] },
): Promise<MediaRenderJobDto> {
  const body: Record<string, unknown> = {};
  if (opts?.profile) body.profile = opts.profile;
  if (opts?.panelIndexes?.length) body.panelIndexes = opts.panelIndexes;
  const data = await ecomBookFetch(
    `api/sso/tools/ecom/storyboard/projects/${projectId}/video/render`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return data.job as MediaRenderJobDto;
}

export async function pollMediaRenderJob(
  jobId: string,
): Promise<MediaRenderJobDto> {
  const data = await ecomBookFetch(
    `api/sso/tools/media/render/${encodeURIComponent(jobId)}`,
    { method: "GET" },
  );
  return data.job as MediaRenderJobDto;
}

export async function waitStoryboardMediaRender(
  jobId: string,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<MediaRenderJobDto> {
  const intervalMs = opts?.intervalMs ?? 2000;
  const timeoutMs = opts?.timeoutMs ?? 15 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await pollMediaRenderJob(jobId);
    if (
      job.status === "SUCCEEDED" ||
      job.status === "FAILED" ||
      job.status === "EXPIRED"
    ) {
      return job;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("云端剪辑超时，请稍后重试");
}

/** @deprecated 请改用 renderStoryboardPanelVideos */
export async function mergeStoryboardPanelVideos(
  projectId: string,
): Promise<{ assetId: string | null; ossUrl: string; expiresAt?: string; jobId?: string }> {
  const data = await ecomBookFetch(
    `api/sso/tools/ecom/storyboard/projects/${projectId}/video/merge`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  const asset = data.asset as { id: string } | null;
  return {
    assetId: asset?.id ?? null,
    ossUrl: data.ossUrl as string,
    expiresAt: data.expiresAt as string | undefined,
    jobId: data.jobId as string | undefined,
  };
}

/** 下载 ZIP 交付包（参考图 + 分镜脚本 + 分镜图/视频 + 成片 + 对话） */
export async function downloadStoryboardExportZip(projectId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(
      `/api/book-mall/api/sso/tools/ecom/storyboard/projects/${projectId}/export`,
      { method: "GET", credentials: "include" },
    );
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
      : "storyboard-export.zip";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
