"use client";

import { EcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  SeedVideoChatMessage,
  SeedVideoPlan,
  SeedVideoProject,
  SeedVideoReference,
  SeedVideoSettings,
} from "@/lib/seed-video-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const BASE = "api/sso/tools/ecom/seed-video";

export async function fetchSeedVideoModels(): Promise<{
  chatModels: StoryboardGatewayModel[];
  videoModels: StoryboardGatewayModel[];
  defaults?: { chat?: string; video?: string };
}> {
  const data = await ecomBookFetch(`${BASE}/models`);
  return {
    chatModels: (data.chatModels as StoryboardGatewayModel[]) ?? [],
    videoModels: (data.videoModels as StoryboardGatewayModel[]) ?? [],
    defaults: data.defaults as { chat?: string; video?: string } | undefined,
  };
}

export async function listSeedVideoProjectSummaries(): Promise<
  Array<{ id: string; title: string | null; updatedAt: string }>
> {
  const data = await ecomBookFetch(`${BASE}/projects?summary=1`);
  return (data.items as Array<{ id: string; title: string | null; updatedAt: string }>) ?? [];
}

export async function createSeedVideoProject(opts?: {
  title?: string;
}): Promise<SeedVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as SeedVideoProject;
}

export async function getSeedVideoProject(id: string): Promise<SeedVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as SeedVideoProject;
}

export async function updateSeedVideoProject(
  id: string,
  patch: Partial<{
    title: string;
    settings: SeedVideoSettings;
    plan: SeedVideoPlan;
    chatHistory: SeedVideoChatMessage[];
    meta: SeedVideoProject["meta"];
    status: string;
  }>,
): Promise<SeedVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as SeedVideoProject;
}

export async function uploadSeedVideoRef(
  projectId: string,
  file: File,
  label?: string,
): Promise<SeedVideoReference> {
  const form = new FormData();
  form.set("file", file);
  if (label) form.set("label", label);
  const res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/refs/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `上传失败 (${res.status})`);
  }
  const data = (await res.json()) as { reference: SeedVideoReference };
  return data.reference;
}

export async function removeSeedVideoRef(projectId: string, refId: string): Promise<void> {
  const res = await fetch(
    `/api/book-mall/${BASE}/projects/${projectId}/refs/upload?refId=${encodeURIComponent(refId)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `删除失败 (${res.status})`);
  }
}

export async function streamSeedVideoChat(opts: {
  projectId: string;
  messages: SeedVideoChatMessage[];
  modelKey: string;
  onChunk: (text: string) => void;
}): Promise<string> {
  let res: Response;
  try {
    res = await fetch(
      `/api/book-mall/${BASE}/projects/${opts.projectId}/assistant/chat`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: opts.messages,
          modelKey: opts.modelKey,
        }),
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Failed to fetch" || /fetch/i.test(msg)) {
      throw new Error(
        "无法连接策划助手（前端编译或服务未就绪）。请硬刷新页面后重试；若仍失败请确认 pnpm dev:all 中 e-commerce-toolkit 与 book-mall 均已启动且无编译报错。",
      );
    }
    throw e;
  }
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    const text = await res.text();
    let err = `请求失败 (${res.status})`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) err = j.error;
    } catch {
      if (text) err = text.slice(0, 200);
    }
    throw new Error(err);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("无响应流");
  const decoder = new TextDecoder();
  let full = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      opts.onChunk(chunk);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "network error" || msg === "Failed to fetch") {
      throw new Error(
        full.trim()
          ? "助手流式连接中断，请重试；若反复失败请检查 Gateway 凭证或换用 Qwen3.5 Plus 等支持图片理解的模型"
          : "助手连接失败，请检查 Gateway 是否已绑定百炼凭证，并换用支持图片理解的模型（如 Qwen3.5 Plus）",
      );
    }
    throw e;
  }
  return full;
}

export async function syncSeedVideoPlan(
  projectId: string,
  opts?: { markdown?: string; userChoice?: string; confirmSync?: boolean },
): Promise<SeedVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/plan/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as SeedVideoProject;
}

export async function generateSeedVideoShot(opts: {
  projectId: string;
  shotIndex: number;
  modelKey: string;
  durationSec?: number;
  aspectRatio?: "9:16" | "16:9";
  resolution?: string;
}): Promise<{ videoUrl: string; shotIndex: number }> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${opts.projectId}/video/panel/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    },
  );
  return data as { videoUrl: string; shotIndex: number };
}

export async function generateSeedVideoDirect(opts: {
  projectId: string;
  modelKey: string;
  durationSec?: number;
  aspectRatio?: string;
  resolution?: string;
}): Promise<{ taskId: string; logId: string; startedAt: string }> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${opts.projectId}/video/direct/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    },
  );
  return data as { taskId: string; logId: string; startedAt: string };
}

export async function pollSeedVideoDirect(projectId: string): Promise<{
  status: string;
  videoUrl?: string;
  assetId?: string;
  taskId?: string;
}> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/video/direct/generate`,
  );
  const raw = data as {
    status?: string;
    videoUrl?: string;
    assetId?: string;
    taskId?: string;
  };
  const status =
    raw.status === "succeeded"
      ? "done"
      : raw.status === "FAILED"
        ? "failed"
        : (raw.status ?? "idle");
  return {
    status,
    videoUrl: raw.videoUrl,
    assetId: raw.assetId,
    taskId: raw.taskId,
  };
}

export async function generateSeedVideoTts(opts: {
  projectId: string;
  shotIndex?: number;
}): Promise<{ shots: unknown[] }> {
  const data = await ecomBookFetch(`${BASE}/projects/${opts.projectId}/tts/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return data as { shots: unknown[] };
}

export async function renderSeedVideo(projectId: string): Promise<{ jobId: string }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/video/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return data as { jobId: string };
}

export async function pollSeedVideoRender(projectId: string): Promise<{
  status: "idle" | "queued" | "running" | "done" | "failed";
  jobId?: string;
  progress?: number;
  progressLabel?: string;
  outputUrl?: string;
  failMessage?: string;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/video/render`);
  const raw = data as {
    status?: string;
    jobId?: string;
    progress?: number;
    progressLabel?: string;
    outputUrl?: string;
    failMessage?: string;
  };
  const s = (raw.status ?? "idle").toLowerCase();
  const status: "idle" | "queued" | "running" | "done" | "failed" =
    s === "succeeded" || s === "done"
      ? "done"
      : s === "failed"
        ? "failed"
        : s === "running" || s === "processing"
          ? "running"
          : s === "queued" || s === "pending"
            ? "queued"
            : "idle";
  return {
    status,
    jobId: raw.jobId,
    progress: typeof raw.progress === "number" ? raw.progress : undefined,
    progressLabel: raw.progressLabel,
    outputUrl: raw.outputUrl,
    failMessage: raw.failMessage,
  };
}

export async function pollSeedVideoMediaRenderJob(jobId: string): Promise<{
  id: string;
  status: string;
  progress: number;
  progressLabel: string | null;
  downloadUrl: string | null;
  errorMessage: string | null;
}> {
  const data = await ecomBookFetch(
    `api/sso/tools/media/render/${encodeURIComponent(jobId)}`,
  );
  return data.job as {
    id: string;
    status: string;
    progress: number;
    progressLabel: string | null;
    downloadUrl: string | null;
    errorMessage: string | null;
  };
}

export async function saveSeedVideoDeliverableSnapshot(
  projectId: string,
  workName: string,
): Promise<{ snapshot: { savedAt: string; title: string }; project: SeedVideoProject }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/deliverable/snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workName }),
  });
  return data as { snapshot: { savedAt: string; title: string }; project: SeedVideoProject };
}

export async function reuseSeedVideoProject(
  projectId: string,
  savedAt?: string,
): Promise<SeedVideoProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/reuse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(savedAt ? { savedAt } : {}),
  });
  return data.project as SeedVideoProject;
}
