/**
 * 浏览器侧 canvas API 客户端：统一处理跨域代理与 cookie。
 */
import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

export type CanvasProjectSummary = {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type CanvasProjectDetail = CanvasProjectSummary & {
  canvas: {
    schemaVersion: number;
    nodes: CanvasNodeRaw[];
    edges: CanvasEdgeRaw[];
    viewport?: { x: number; y: number; zoom: number };
  };
};

export type CanvasNodeRaw = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type CanvasEdgeRaw = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type CanvasEngineModel = {
  id: string;
  modelKey: string;
  displayName: string;
  vendor: string;
  role: "IMAGE" | "VIDEO" | "LLM";
  description: string | null;
  sortOrder: number;
  active: boolean;
  defaultParams: Record<string, unknown> | null;
  builtin?: boolean;
};

export type CanvasTaskRecord = {
  id: string;
  nodeId: string;
  kind: "IMAGE" | "TEXT";
  status: "PENDING" | "SUBMITTED" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  model: string;
  ossUrl: string | null;
  ephemeralUrl: string | null;
  textOutput: string | null;
  failCode: string | null;
  failMessage: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

async function call<T>(
  base: string,
  apiPath: string,
  init?: RequestInit,
): Promise<T> {
  const { url, init: i } = resolveBookMallBrowserRequest(base, apiPath, init);
  const r = await fetch(url, i);
  // 一次性读出 body：Response.body 是 ReadableStream，只能消费一次。
  // 读完之后再决定 JSON / 文本，避免出现 "body stream already read"。
  const raw = await r.text();
  if (!r.ok) {
    let msg = "";
    try {
      const j = JSON.parse(raw) as { error?: string; message?: string };
      msg = j.message ?? j.error ?? "";
    } catch {
      msg = raw;
    }
    throw new Error(`${r.status} ${msg || r.statusText}`);
  }
  if (!raw) return undefined as unknown as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Bad JSON from ${apiPath}: ${raw.slice(0, 200)}`);
  }
}

// ── projects ──

export async function listMyCanvasProjects(
  base: string,
): Promise<CanvasProjectSummary[]> {
  const j = await call<{ projects: CanvasProjectSummary[] }>(
    base,
    "/api/canvas/projects",
  );
  return j.projects;
}

export async function createCanvasProject(
  base: string,
  args: { name: string; description?: string; canvas?: unknown },
): Promise<CanvasProjectDetail> {
  const j = await call<{ project: CanvasProjectDetail }>(
    base,
    "/api/canvas/projects",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    },
  );
  return j.project;
}

export async function getCanvasProject(
  base: string,
  id: string,
): Promise<CanvasProjectDetail> {
  const j = await call<{ project: CanvasProjectDetail }>(
    base,
    `/api/canvas/projects/${id}`,
  );
  return j.project;
}

export async function patchCanvasProject(
  base: string,
  id: string,
  patch: { name?: string; description?: string; canvas?: unknown; thumbnailUrl?: string },
): Promise<CanvasProjectDetail> {
  const j = await call<{ project: CanvasProjectDetail }>(
    base,
    `/api/canvas/projects/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  return j.project;
}

export async function deleteCanvasProject(
  base: string,
  id: string,
): Promise<void> {
  await call<{ ok: true }>(base, `/api/canvas/projects/${id}`, {
    method: "DELETE",
  });
}

// ── engine models ──

export async function listCanvasEngineModels(
  base: string,
): Promise<{ models: CanvasEngineModel[]; builtinFallback?: boolean }> {
  return call<{ models: CanvasEngineModel[]; builtinFallback?: boolean }>(
    base,
    "/api/canvas/engine-models",
  );
}

export async function adminCreateEngineModel(
  base: string,
  args: {
    modelKey: string;
    displayName: string;
    vendor: string;
    role: "IMAGE" | "VIDEO" | "LLM";
    description?: string;
    sortOrder?: number;
    active?: boolean;
    defaultParams?: Record<string, unknown>;
  },
): Promise<CanvasEngineModel> {
  const j = await call<{ model: CanvasEngineModel }>(
    base,
    "/api/canvas/engine-models",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    },
  );
  return j.model;
}

export async function adminPatchEngineModel(
  base: string,
  args: Partial<CanvasEngineModel> & { id: string },
): Promise<CanvasEngineModel> {
  const j = await call<{ model: CanvasEngineModel }>(
    base,
    "/api/canvas/engine-models",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    },
  );
  return j.model;
}

// ── runs / tasks ──

export async function runCanvasNode(
  base: string,
  projectId: string,
  nodeId: string,
  body: {
    node: {
      type: string;
      modelKey?: string;
      data: Record<string, unknown>;
      imageInputs?: string[];
      textInputs?: string[];
    };
    /** 阶段 4：跳过缓存，强制创建新任务（"重新生成"） */
    forceFresh?: boolean;
  },
): Promise<{ reused: boolean; task: CanvasTaskRecord }> {
  return call<{ reused: boolean; task: CanvasTaskRecord }>(
    base,
    `/api/canvas/projects/${projectId}/nodes/${nodeId}/run`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export async function deleteCanvasTask(
  base: string,
  projectId: string,
  taskId: string,
): Promise<void> {
  await call<{ ok: true }>(
    base,
    `/api/canvas/projects/${projectId}/tasks/${taskId}`,
    { method: "DELETE" },
  );
}

export async function listCanvasProjectTasks(
  base: string,
  projectId: string,
  nodeIds?: string[],
): Promise<CanvasTaskRecord[]> {
  const q = nodeIds && nodeIds.length > 0
    ? `?nodeIds=${encodeURIComponent(nodeIds.join(","))}`
    : "";
  const j = await call<{ tasks: CanvasTaskRecord[] }>(
    base,
    `/api/canvas/projects/${projectId}/tasks${q}`,
  );
  return j.tasks;
}

// ── uploads ──

export async function uploadCanvasImage(
  base: string,
  file: File,
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { url, init } = resolveBookMallBrowserRequest(
    base,
    "/api/canvas/uploads",
    { method: "POST", body: form },
  );
  const r = await fetch(url, init);
  if (!r.ok) {
    throw new Error(`upload failed ${r.status}`);
  }
  const j = (await r.json()) as { ossUrl?: string };
  if (!j.ossUrl) throw new Error("upload missing ossUrl");
  return j.ossUrl;
}

// ── works (gallery) ──

export type CanvasWorkRecord = {
  id: string;
  projectId: string;
  nodeId: string;
  model: string;
  ossUrl: string;
  completedAt: string | null;
  createdAt: string;
  project: { id: string; name: string } | null;
};

export async function listCanvasWorks(base: string): Promise<CanvasWorkRecord[]> {
  const j = await call<{ works: CanvasWorkRecord[] }>(base, "/api/canvas/works");
  return j.works;
}

// ── templates ──

export type CanvasTemplateRecord = {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  builtin: boolean;
  ownerUserId: string | null;
  canvas: unknown;
  createdAt: string;
  updatedAt: string;
};

export async function listCanvasTemplates(
  base: string,
): Promise<CanvasTemplateRecord[]> {
  const j = await call<{ templates: CanvasTemplateRecord[] }>(
    base,
    "/api/canvas/templates",
  );
  return j.templates;
}

export async function saveCanvasTemplate(
  base: string,
  args: { name: string; canvas: unknown; category?: string; thumbnail?: string },
): Promise<CanvasTemplateRecord> {
  const j = await call<{ template: CanvasTemplateRecord }>(
    base,
    "/api/canvas/templates",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    },
  );
  return j.template;
}
