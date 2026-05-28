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

export type CanvasTaskStoryScope = {
  rowKey?: string;
  mediaKind?: string;
  llmSection?: string;
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
  /** 百炼 / KIE 等外部异步任务 ID */
  kieTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  /** 漫剧列行 / 文案段（来自任务 inputPayload.storyScope） */
  storyScope?: CanvasTaskStoryScope;
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
    llmSection?: "outline" | "character" | "storyboard";
    rowKey?: string;
    mediaKind?: "threeView" | "frameImage" | "video" | "tts" | "sceneRef";
    /** 影视专业版 · 风格定稿门禁 */
    styleFinalized?: boolean;
    styleAnchor?: {
      styleAnchorZh?: string;
      styleAnchorEn?: string;
      negativePrompt?: string;
    };
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
  return uploadCanvasFile(base, file);
}

export async function uploadCanvasFile(
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
    let detail = String(r.status);
    try {
      const j = (await r.json()) as { message?: string; error?: string };
      detail = j.message ?? j.error ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`upload failed: ${detail}`);
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

// ── characters (三视图角色) ──

export type CanvasCharacterRecord = {
  id: string;
  name: string;
  imageUrl: string;
  model: string | null;
  sourceTaskId: string | null;
  sourceProjectId: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listCanvasCharacters(
  base: string,
): Promise<CanvasCharacterRecord[]> {
  const j = await call<{ characters: CanvasCharacterRecord[] }>(
    base,
    "/api/canvas/characters",
  );
  return j.characters;
}

export async function saveCanvasCharacter(
  base: string,
  args: {
    name: string;
    imageUrl: string;
    model?: string | null;
    sourceTaskId?: string | null;
    sourceProjectId?: string | null;
  },
): Promise<CanvasCharacterRecord> {
  const j = await call<{ character: CanvasCharacterRecord }>(
    base,
    "/api/canvas/characters",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    },
  );
  return j.character;
}

export async function deleteCanvasCharacter(
  base: string,
  id: string,
): Promise<void> {
  await call(base, `/api/canvas/characters/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ── 影视专业版 · 角色资产库 ──

export type StoryProCharacterAssetRefRecord = {
  id: string;
  kind: "face" | "full_body" | "outfit" | "three_view";
  ossUrl: string;
  sortOrder: number;
  label: string | null;
  sourceTaskId: string | null;
  createdAt: string;
};

export type StoryProCharacterAssetRecord = {
  id: string;
  characterKey: string;
  displayName: string;
  projectId: string | null;
  locked: boolean;
  version: number;
  refs: StoryProCharacterAssetRefRecord[];
  createdAt: string;
  updatedAt: string;
};

export async function listStoryProCharacterAssets(
  base: string,
  projectId?: string | null,
): Promise<StoryProCharacterAssetRecord[]> {
  const q =
    projectId != null && projectId !== ""
      ? `?projectId=${encodeURIComponent(projectId)}`
      : "";
  const j = await call<{ assets: StoryProCharacterAssetRecord[] }>(
    base,
    `/api/canvas/story-pro/character-assets${q}`,
  );
  return j.assets;
}

export async function saveStoryProCharacterAssetRef(
  base: string,
  args: {
    characterKey: string;
    displayName: string;
    projectId?: string | null;
    kind?: StoryProCharacterAssetRefRecord["kind"];
    ossUrl: string;
    label?: string | null;
    sourceTaskId?: string | null;
  },
): Promise<StoryProCharacterAssetRecord> {
  const j = await call<{ asset: StoryProCharacterAssetRecord }>(
    base,
    "/api/canvas/story-pro/character-assets",
    {
      method: "POST",
      body: JSON.stringify(args),
    },
  );
  return j.asset;
}

export async function setStoryProCharacterAssetLocked(
  base: string,
  assetId: string,
  locked: boolean,
): Promise<StoryProCharacterAssetRecord> {
  const j = await call<{ asset: StoryProCharacterAssetRecord }>(
    base,
    `/api/canvas/story-pro/character-assets/${encodeURIComponent(assetId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ locked }),
    },
  );
  return j.asset;
}

export async function deleteStoryProCharacterAssetRef(
  base: string,
  refId: string,
): Promise<StoryProCharacterAssetRecord> {
  const j = await call<{ asset: StoryProCharacterAssetRecord }>(
    base,
    `/api/canvas/story-pro/character-assets/refs/${encodeURIComponent(refId)}`,
    { method: "DELETE" },
  );
  return j.asset;
}

export async function autoFillStoryProCharacterSlotsFromThreeView(
  base: string,
  args: {
    characterKey: string;
    displayName: string;
    projectId?: string | null;
    threeViewUrl: string;
    sourceTaskId?: string | null;
    onlyEmpty?: boolean;
  },
): Promise<{
  filled: ("face" | "full_body" | "outfit")[];
  skipped: ("face" | "full_body" | "outfit")[];
  asset: StoryProCharacterAssetRecord;
}> {
  return call(base, "/api/canvas/story-pro/character-assets/auto-fill-from-three-view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
}

/** 以全身槽图经 Gateway 百炼分割，覆盖服装槽 */
export async function parseStoryProOutfitFromFullBody(
  base: string,
  args: {
    characterKey: string;
    displayName: string;
    projectId?: string | null;
    fullBodyUrl: string;
    sourceTaskId?: string | null;
  },
): Promise<{
  asset: StoryProCharacterAssetRecord;
  outfitOssUrl: string;
  segments: number;
}> {
  return call(
    base,
    "/api/canvas/story-pro/character-assets/parse-outfit-from-full-body",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    },
  );
}

// ── 影视专业版 · 场景资产库 ──

export type StoryProSceneAssetRefRecord = {
  id: string;
  kind: "establishing" | "detail" | "mood";
  ossUrl: string;
  sortOrder: number;
  label: string | null;
  sourceTaskId: string | null;
  createdAt: string;
};

export type StoryProSceneAssetRecord = {
  id: string;
  sceneKey: string;
  displayName: string;
  projectId: string | null;
  locked: boolean;
  version: number;
  refs: StoryProSceneAssetRefRecord[];
  createdAt: string;
  updatedAt: string;
};

export async function listStoryProSceneAssets(
  base: string,
  projectId?: string | null,
): Promise<StoryProSceneAssetRecord[]> {
  const q =
    projectId != null && projectId !== ""
      ? `?projectId=${encodeURIComponent(projectId)}`
      : "";
  const j = await call<{ assets: StoryProSceneAssetRecord[] }>(
    base,
    `/api/canvas/story-pro/scene-assets${q}`,
  );
  return j.assets;
}

export async function saveStoryProSceneAssetRef(
  base: string,
  args: {
    sceneKey: string;
    displayName: string;
    projectId?: string | null;
    kind?: StoryProSceneAssetRefRecord["kind"];
    ossUrl: string;
    label?: string | null;
    sourceTaskId?: string | null;
  },
): Promise<StoryProSceneAssetRecord> {
  const j = await call<{ asset: StoryProSceneAssetRecord }>(
    base,
    "/api/canvas/story-pro/scene-assets",
    { method: "POST", body: JSON.stringify(args) },
  );
  return j.asset;
}

export async function setStoryProSceneAssetLocked(
  base: string,
  assetId: string,
  locked: boolean,
): Promise<StoryProSceneAssetRecord> {
  const j = await call<{ asset: StoryProSceneAssetRecord }>(
    base,
    `/api/canvas/story-pro/scene-assets/${encodeURIComponent(assetId)}`,
    { method: "PATCH", body: JSON.stringify({ locked }) },
  );
  return j.asset;
}

export async function deleteStoryProSceneAssetRef(
  base: string,
  refId: string,
): Promise<StoryProSceneAssetRecord> {
  const j = await call<{ asset: StoryProSceneAssetRecord }>(
    base,
    `/api/canvas/story-pro/scene-assets/refs/${encodeURIComponent(refId)}`,
    { method: "DELETE" },
  );
  return j.asset;
}

// ── 剪映导出 ──

export type JianyingExportFrame = {
  frameIndex: number;
  dialogue: string;
  videoUrl?: string | null;
  audioUrl?: string | null;
  durationSec?: number;
};

export async function exportJianyingZip(
  base: string,
  projectId: string,
  args: { format: "bundle" | "draft"; frames: JianyingExportFrame[] },
): Promise<void> {
  const { url, init } = resolveBookMallBrowserRequest(
    base,
    `/api/canvas/projects/${encodeURIComponent(projectId)}/export/jianying`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: args.format, frames: args.frames }),
    },
  );
  const r = await fetch(url, init);
  if (!r.ok) {
    const raw = await r.text();
    throw new Error(raw || `export failed HTTP ${r.status}`);
  }
  const blob = await r.blob();
  const filename =
    args.format === "draft"
      ? `jianying-draft-${projectId.slice(0, 8)}.zip`
      : `story-bundle-${projectId.slice(0, 8)}.zip`;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}
