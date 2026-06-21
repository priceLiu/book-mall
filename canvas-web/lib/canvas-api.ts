/**
 * 浏览器侧 canvas API 客户端：统一处理跨域代理与 cookie。
 */
import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import { ensureCanvasUploadFileMeta } from "@/lib/canvas/normalize-canvas-image-file";

/** 无权限或项目不存在时停止 tasks 轮询，避免控制台 404 刷屏 */
const forbiddenCanvasProjectIds = new Set<string>();

export function isCanvasProjectTasksForbidden(projectId: string): boolean {
  return forbiddenCanvasProjectIds.has(projectId);
}

export function markCanvasProjectTasksForbidden(projectId: string): void {
  forbiddenCanvasProjectIds.add(projectId);
}

export function clearCanvasProjectTasksForbidden(projectId: string): void {
  forbiddenCanvasProjectIds.delete(projectId);
}

export function isCanvasApiAccessDeniedError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /\b403\b/.test(msg) || /\b404\b/.test(msg);
}

/** @deprecated 使用 isCanvasApiAccessDeniedError */
export function isCanvasApiNotFoundError(e: unknown): boolean {
  return isCanvasApiAccessDeniedError(e);
}

function markForbiddenCanvasProjectFromPath(
  status: number,
  apiPath: string,
): void {
  if (status !== 403 && status !== 404) return;
  const m = apiPath.match(/^\/api\/canvas\/projects\/([^/?]+)/);
  if (m?.[1]) markCanvasProjectTasksForbidden(m[1]);
}

export type CanvasProjectSummary = {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  edition: "pro" | "pro2" | "sbv1" | "standard";
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
  status: "QUEUED" | "DISPATCHING" | "PENDING" | "SUBMITTED" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  model: string;
  ossUrl: string | null;
  ephemeralUrl: string | null;
  posterUrl?: string | null;
  textOutput: string | null;
  failCode: string | null;
  failMessage: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  /** 百炼 / KIE 等外部异步任务 ID */
  kieTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  creditsCharged?: number | null;
  billingMode?: "PLATFORM_CREDIT" | "BYOK" | null;
  /** 漫剧列行 / 文案段（来自任务 inputPayload.storyScope） */
  storyScope?: CanvasTaskStoryScope;
};

/** 将 API 错误码转为界面可读文案 */
export function formatCanvasApiError(raw: string): string {
  const t = raw.trim();
  if (!t) return "加载失败，请稍后重试";
  if (t.includes("DATABASE_UNAVAILABLE") || t.includes("503")) {
    return "数据库暂不可用。请确认本机能访问 book-mall 配置的 PostgreSQL，或稍后重试。";
  }
  if (t.includes("401") || t.includes("UNAUTHORIZED")) {
    return "登录已失效，请重新连接主站账号。";
  }
  if (t.includes("INTERNAL_ERROR")) {
    return "服务器处理失败，请稍后重试；若持续出现请查看 book-mall 终端日志。";
  }
  if (t.includes("book_mall_url_missing") || t.includes("503")) {
    return "未配置主站地址（NEXT_PUBLIC_BOOK_MALL_URL），无法加载画布列表。";
  }
  if (t.includes("book_mall_proxy_failed") || t.includes("ECONNREFUSED")) {
    return "无法连接主站 book-mall（:3000）。请确认已运行 pnpm dev:all，且 book-mall 进程正常。";
  }
  if (/<!DOCTYPE html>/i.test(t) || /<html[\s>]/i.test(t)) {
    if (/\b404\b/.test(t)) {
      return "保存接口未找到（404）。请确认 book-mall（:3000）与 canvas-web（:3004）均在运行；若刚执行过 build，请重启 dev:all 或删除 canvas-web/.next 后重试。";
    }
    if (/\b500\b/.test(t)) {
      return "画布服务内部错误（500）。请重启 canvas-web 开发服务；若仍失败，删除 canvas-web/.next 后重试。";
    }
    return "服务器返回了异常页面而非 JSON，请重启 canvas-web / book-mall 开发服务后重试。";
  }
  return t;
}

function sanitizeCanvasApiErrorBody(status: number, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/<!DOCTYPE html>/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    return formatCanvasApiError(`${status} ${trimmed}`);
  }
  try {
    const j = JSON.parse(trimmed) as { error?: string; message?: string };
    return j.message ?? j.error ?? trimmed;
  } catch {
    return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
  }
}

async function call<T>(
  base: string,
  apiPath: string,
  init?: RequestInit,
): Promise<T> {
  if (!base.trim() && typeof window !== "undefined") {
    throw new Error(
      "未配置主站地址（NEXT_PUBLIC_BOOK_MALL_URL），无法调用画布 API。",
    );
  }
  const { url, init: i } = resolveBookMallBrowserRequest(base, apiPath, init);
  const r = await fetch(url, i);
  // 一次性读出 body：Response.body 是 ReadableStream，只能消费一次。
  // 读完之后再决定 JSON / 文本，避免出现 "body stream already read"。
  const raw = await r.text();
  if (!r.ok) {
    const msg = sanitizeCanvasApiErrorBody(r.status, raw);
    markForbiddenCanvasProjectFromPath(r.status, apiPath);
    throw new Error(msg ? `${r.status} ${msg}` : `${r.status} ${r.statusText}`);
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

export type CanvasProjectHistorySummary = {
  id: string;
  projectId: string;
  label: string;
  source: string;
  thumbnailUrl: string;
  createdAt: string;
};

export type CanvasProjectHistoryMeta = {
  autosaveCount: number;
  manualCount: number;
  maxPerSource: number;
  oldestManual: CanvasProjectHistorySummary | null;
};

export type CanvasProjectHistorySnapshotRequest = {
  source?: "autosave" | "manual";
  label?: string;
};

export async function patchCanvasProject(
  base: string,
  id: string,
  patch: {
    name?: string;
    description?: string;
    canvas?: unknown;
    thumbnailUrl?: string;
    historySnapshot?: CanvasProjectHistorySnapshotRequest;
  },
): Promise<{
  project: CanvasProjectDetail;
  historyItem: CanvasProjectHistorySummary | null;
}> {
  const j = await call<{
    project: CanvasProjectDetail;
    historyItem?: CanvasProjectHistorySummary | null;
  }>(base, `/api/canvas/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return { project: j.project, historyItem: j.historyItem ?? null };
}

export type CanvasProjectHistoryDetail = CanvasProjectHistorySummary & {
  canvas: CanvasProjectDetail["canvas"];
};

export async function listCanvasProjectHistory(
  base: string,
  projectId: string,
  opts?: { source?: "autosave" | "manual" },
): Promise<{ items: CanvasProjectHistorySummary[]; meta: CanvasProjectHistoryMeta }> {
  const q =
    opts?.source != null
      ? `?source=${encodeURIComponent(opts.source)}`
      : "";
  const j = await call<{
    items: CanvasProjectHistorySummary[];
    meta: CanvasProjectHistoryMeta;
  }>(base, `/api/canvas/projects/${projectId}/history${q}`);
  return { items: j.items, meta: j.meta };
}

export async function deleteCanvasProjectHistoryEntry(
  base: string,
  projectId: string,
  historyId: string,
): Promise<void> {
  await call<{ ok: true }>(
    base,
    `/api/canvas/projects/${projectId}/history/${historyId}`,
    { method: "DELETE" },
  );
}

export type CanvasGenerationRecord = CanvasTaskRecord & {
  projectId?: string;
  projectName?: string;
  providerLabel?: string;
  modelLabel?: string;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  previewKind?: "image" | "video" | null;
  previewMedia?: Array<{
    url: string;
    kind: "image" | "video";
    label: string;
  }>;
  canvasHistoryId?: string | null;
  canRestoreCanvas?: boolean;
  /** 关联 nodeId 是否仍在 persisted 画布上；无 nodeId 时为 null */
  nodePresent?: boolean | null;
  /** 旧接口回退：参考图（失败任务缩略图） */
  mainFrameImageUrl?: string | null;
  referenceImageUrls?: string[] | null;
};

export async function listCanvasGenerationRecords(
  base: string,
  projectId: string,
): Promise<{
  projectTasks: CanvasGenerationRecord[];
  todayTasks: CanvasGenerationRecord[];
  since: string;
}> {
  const j = await call<{
    projectTasks: CanvasGenerationRecord[];
    todayTasks: CanvasGenerationRecord[];
    since: string;
  }>(base, `/api/canvas/projects/${projectId}/generation-records`);
  return j;
}


export async function getCanvasProjectHistoryEntry(
  base: string,
  projectId: string,
  historyId: string,
): Promise<CanvasProjectHistoryDetail> {
  const q = new URLSearchParams({ entryId: historyId });
  const j = await call<{ item: CanvasProjectHistoryDetail }>(
    base,
    `/api/canvas/projects/${projectId}/history?${q.toString()}`,
  );
  return j.item;
}

export async function createCanvasProjectHistorySnapshot(
  base: string,
  projectId: string,
  args: {
    canvas: unknown;
    thumbnailUrl?: string;
    source?: "autosave" | "manual";
    label?: string;
  },
): Promise<CanvasProjectHistorySummary> {
  const j = await call<{ item: CanvasProjectHistorySummary }>(
    base,
    `/api/canvas/projects/${projectId}/history`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    },
  );
  return j.item;
}

export async function deleteCanvasProject(
  base: string,
  id: string,
): Promise<void> {
  await call<{ ok: true }>(base, `/api/canvas/projects/${id}`, {
    method: "DELETE",
  });
}

export async function duplicateCanvasProject(
  base: string,
  id: string,
): Promise<CanvasProjectDetail> {
  const j = await call<{ project: CanvasProjectDetail }>(
    base,
    `/api/canvas/projects/${id}/duplicate`,
    { method: "POST" },
  );
  return j.project;
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
      portraitAssetRefs?: Array<{
        url: string;
        role?: "reference_image" | "first_frame" | "last_frame";
      }>;
    };
    /** 阶段 4：跳过缓存，强制创建新任务（"重新生成"） */
    forceFresh?: boolean;
    llmSection?: "outline" | "character" | "scene" | "storyboard";
    rowKey?: string;
    mediaKind?:
      | "threeView"
      | "frameImage"
      | "video"
      | "tts"
      | "sceneRef"
      | "themeOutline";
    /** 影视专业版 · 风格定稿门禁 */
    styleFinalized?: boolean;
    styleAnchor?: {
      styleAnchorZh?: string;
      styleAnchorEn?: string;
      negativePrompt?: string;
    };
    /** 生成前画布快照 · 用于生成记录恢复整图 */
    canvasSnapshot?: {
      canvas: unknown;
      thumbnailUrl?: string;
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

/**
 * 拉取项目任务列表。
 *
 * 返回 `null` 表示后端读道「降级 / 超时」（DB 塞车或不可用），调用方应
 * **保留上一帧快照、不要覆盖**，避免画布因一次读失败而清空显示。
 */
export async function listCanvasProjectTasks(
  base: string,
  projectId: string,
  nodeIds?: string[],
): Promise<CanvasTaskRecord[] | null> {
  if (isCanvasProjectTasksForbidden(projectId)) {
    throw new Error("403 无权访问此画布项目");
  }
  const q = nodeIds && nodeIds.length > 0
    ? `?nodeIds=${encodeURIComponent(nodeIds.join(","))}`
    : "";
  const j = await call<{ tasks: CanvasTaskRecord[] | null; stale?: boolean }>(
    base,
    `/api/canvas/projects/${projectId}/tasks${q}`,
  );
  if (j.stale || j.tasks == null) return null;
  return j.tasks;
}

// ── uploads ──

export async function uploadCanvasImage(
  base: string,
  file: File,
): Promise<string> {
  return uploadCanvasFile(base, ensureCanvasUploadFileMeta(file));
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

// ── 影视专业版 · 全局风格配置 ──

export type StoryProStyleProfileRecord = {
  id: string;
  projectId: string | null;
  profileKey: string;
  displayName: string;
  locked: boolean;
  version: number;
  mainStyle: string | null;
  colorTone: string | null;
  renderQuality: string | null;
  anchorZh: string | null;
  anchorEn: string | null;
  negativePrompt: string | null;
  refImageUrls: string[];
  createdAt: string;
  updatedAt: string;
};

export async function listStoryProStyleProfiles(
  base: string,
  projectId?: string | null,
): Promise<StoryProStyleProfileRecord[]> {
  const q =
    projectId != null && projectId !== ""
      ? `?projectId=${encodeURIComponent(projectId)}`
      : "";
  const j = await call<{ profiles: StoryProStyleProfileRecord[] }>(
    base,
    `/api/canvas/story-pro/style-profiles${q}`,
  );
  return j.profiles;
}

export async function saveStoryProStyleProfile(
  base: string,
  args: {
    projectId?: string | null;
    profileKey?: string;
    displayName: string;
    mainStyle?: string | null;
    colorTone?: string | null;
    renderQuality?: string | null;
    anchorZh?: string | null;
    anchorEn?: string | null;
    negativePrompt?: string | null;
    refImageUrls?: string[];
  },
): Promise<StoryProStyleProfileRecord> {
  const j = await call<{ profile: StoryProStyleProfileRecord }>(
    base,
    "/api/canvas/story-pro/style-profiles",
    { method: "POST", body: JSON.stringify(args) },
  );
  return j.profile;
}

export async function setStoryProStyleProfileLocked(
  base: string,
  profileId: string,
  locked: boolean,
): Promise<StoryProStyleProfileRecord> {
  const j = await call<{ profile: StoryProStyleProfileRecord }>(
    base,
    "/api/canvas/story-pro/style-profiles",
    { method: "PATCH", body: JSON.stringify({ profileId, locked }) },
  );
  return j.profile;
}

// ── 影视专业版 · 角色音频资产 ──

export type StoryProCharacterAudioAssetRecord = {
  id: string;
  characterKey: string;
  displayName: string;
  projectId: string | null;
  locked: boolean;
  version: number;
  voiceLabel: string | null;
  voiceId: string | null;
  sampleOssUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listStoryProCharacterAudioAssets(
  base: string,
  projectId?: string | null,
): Promise<StoryProCharacterAudioAssetRecord[]> {
  const q =
    projectId != null && projectId !== ""
      ? `?projectId=${encodeURIComponent(projectId)}`
      : "";
  const j = await call<{ assets: StoryProCharacterAudioAssetRecord[] }>(
    base,
    `/api/canvas/story-pro/audio-assets${q}`,
  );
  return j.assets;
}

export async function saveStoryProCharacterAudioAsset(
  base: string,
  args: {
    characterKey: string;
    displayName: string;
    projectId?: string | null;
    voiceLabel?: string | null;
    voiceId?: string | null;
    sampleOssUrl?: string | null;
    notes?: string | null;
  },
): Promise<StoryProCharacterAudioAssetRecord> {
  const j = await call<{ asset: StoryProCharacterAudioAssetRecord }>(
    base,
    "/api/canvas/story-pro/audio-assets",
    { method: "POST", body: JSON.stringify(args) },
  );
  return j.asset;
}

export async function setStoryProCharacterAudioAssetLocked(
  base: string,
  assetId: string,
  locked: boolean,
): Promise<StoryProCharacterAudioAssetRecord> {
  const j = await call<{ asset: StoryProCharacterAudioAssetRecord }>(
    base,
    "/api/canvas/story-pro/audio-assets",
    { method: "PATCH", body: JSON.stringify({ assetId, locked }) },
  );
  return j.asset;
}

// ── 剧本创作助手 ──

export type ScriptAssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ScriptAssistantHistoryThread = {
  workflowKey: string;
  theme: string | null;
  messageCount: number;
  updatedAt: string;
};

export async function listScriptAssistantHistoryThreads(
  base: string,
  projectId: string,
): Promise<ScriptAssistantHistoryThread[]> {
  const j = await call<{ threads: ScriptAssistantHistoryThread[] }>(
    base,
    `/api/canvas/story-pro/script-assistant/history?projectId=${encodeURIComponent(projectId)}&listThreads=1`,
  );
  return j.threads ?? [];
}

export async function getScriptAssistantHistory(
  base: string,
  projectId: string,
  workflowKey: string,
): Promise<ScriptAssistantMessage[]> {
  const j = await call<{ messages: ScriptAssistantMessage[] }>(
    base,
    `/api/canvas/story-pro/script-assistant/history?projectId=${encodeURIComponent(projectId)}&workflowKey=${encodeURIComponent(workflowKey)}`,
  );
  return j.messages;
}

export async function saveScriptAssistantHistory(
  base: string,
  projectId: string,
  workflowKey: string,
  messages: ScriptAssistantMessage[],
  theme?: string,
): Promise<ScriptAssistantMessage[]> {
  const j = await call<{ messages: ScriptAssistantMessage[] }>(
    base,
    "/api/canvas/story-pro/script-assistant/history",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, workflowKey, theme, messages }),
    },
  );
  return j.messages;
}

export async function clearScriptAssistantHistory(
  base: string,
  projectId: string,
  workflowKey: string,
): Promise<void> {
  await call<{ ok: boolean }>(
    base,
    `/api/canvas/story-pro/script-assistant/history?projectId=${encodeURIComponent(projectId)}&workflowKey=${encodeURIComponent(workflowKey)}`,
    { method: "DELETE" },
  );
}

export async function streamScriptAssistantChat(
  base: string,
  messages: { role: "user" | "assistant"; content: string }[],
  outputMode: "chat" | "pack" = "chat",
): Promise<Response> {
  const { url, init } = resolveBookMallBrowserRequest(
    base,
    "/api/canvas/story-pro/script-assistant/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, outputMode }),
    },
  );
  return fetch(url, init);
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

// ── 云端自动剪辑 ──

export type MediaRenderJob = {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "EXPIRED";
  progress: number;
  progressLabel?: string | null;
  downloadUrl: string | null;
  expiresAt: string;
  errorMessage: string | null;
};

export type MediaRenderProfile = {
  transition?: { type: "xfade"; durationSec: number } | { type: "none" };
  subtitle?: { mode: "script" | "none"; burnIn?: boolean };
};

export async function submitMediaRender(
  base: string,
  projectId: string,
  args: { frames: JianyingExportFrame[]; profile?: MediaRenderProfile },
): Promise<MediaRenderJob> {
  const { url, init } = resolveBookMallBrowserRequest(
    base,
    `/api/canvas/projects/${encodeURIComponent(projectId)}/media/render`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames: args.frames, profile: args.profile }),
    },
  );
  const r = await fetch(url, init);
  const data = (await r.json().catch(() => ({}))) as {
    job?: MediaRenderJob;
    message?: string;
    error?: string;
  };
  if (!r.ok) {
    throw new Error(data.message ?? data.error ?? `render failed HTTP ${r.status}`);
  }
  if (!data.job) throw new Error("invalid render response");
  return data.job;
}

export async function pollMediaRender(
  base: string,
  jobId: string,
): Promise<MediaRenderJob> {
  const { url, init } = resolveBookMallBrowserRequest(
    base,
    `/api/canvas/media/render/${encodeURIComponent(jobId)}`,
    { method: "GET" },
  );
  const r = await fetch(url, init);
  const data = (await r.json().catch(() => ({}))) as {
    job?: MediaRenderJob;
    message?: string;
  };
  if (!r.ok) {
    throw new Error(data.message ?? `poll failed HTTP ${r.status}`);
  }
  if (!data.job) throw new Error("invalid poll response");
  return data.job;
}

export async function waitMediaRenderJob(
  base: string,
  jobId: string,
  opts?: {
    intervalMs?: number;
    timeoutMs?: number;
    onPoll?: (job: MediaRenderJob) => void;
  },
): Promise<MediaRenderJob> {
  const intervalMs = opts?.intervalMs ?? 1500;
  const timeoutMs = opts?.timeoutMs ?? 15 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await pollMediaRender(base, jobId);
    opts?.onPoll?.(job);
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

export type {
  ProjectAssetKind,
  ProjectAssetRecord,
  CreateProjectAssetInput,
  AssetVisibility,
  InsertMapResult,
} from "@/lib/canvas/project-asset-types";

export async function listProjectAssets(
  base: string,
  opts?: {
    projectId?: string | null;
    kind?: import("@/lib/canvas/project-asset-types").ProjectAssetKind;
    scope?: "all" | "project" | "library";
    visibility?: import("@/lib/canvas/project-asset-types").AssetVisibility | "all";
    q?: string;
  },
): Promise<import("@/lib/canvas/project-asset-types").ProjectAssetRecord[]> {
  const sp = new URLSearchParams();
  if (opts?.projectId) sp.set("projectId", opts.projectId);
  if (opts?.kind) sp.set("kind", opts.kind);
  if (opts?.scope) sp.set("scope", opts.scope);
  if (opts?.visibility) sp.set("visibility", opts.visibility);
  if (opts?.q) sp.set("q", opts.q);
  const q = sp.toString();
  const j = await call<{ assets: import("@/lib/canvas/project-asset-types").ProjectAssetRecord[] }>(
    base,
    `/api/canvas/project-assets${q ? `?${q}` : ""}`,
  );
  return j.assets ?? [];
}

export async function createProjectAsset(
  base: string,
  input: import("@/lib/canvas/project-asset-types").CreateProjectAssetInput,
): Promise<import("@/lib/canvas/project-asset-types").ProjectAssetRecord> {
  const j = await call<{ asset: import("@/lib/canvas/project-asset-types").ProjectAssetRecord }>(
    base,
    "/api/canvas/project-assets",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return j.asset;
}

export async function patchProjectAsset(
  base: string,
  assetId: string,
  patch: {
    displayName?: string;
    description?: string;
    visibility?: import("@/lib/canvas/project-asset-types").AssetVisibility;
    locked?: boolean;
  },
): Promise<import("@/lib/canvas/project-asset-types").ProjectAssetRecord> {
  const j = await call<{ asset: import("@/lib/canvas/project-asset-types").ProjectAssetRecord }>(
    base,
    `/api/canvas/project-assets/${encodeURIComponent(assetId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  return j.asset;
}

export async function deleteProjectAsset(
  base: string,
  assetId: string,
): Promise<{ ossUrls: string[] }> {
  return call<{ ossUrls: string[] }>(
    base,
    `/api/canvas/project-assets/${encodeURIComponent(assetId)}`,
    { method: "DELETE" },
  );
}

export async function acquireProjectAssetLease(
  base: string,
  assetId: string,
  opts?: { force?: boolean },
): Promise<import("@/lib/canvas/project-asset-types").ProjectAssetRecord> {
  const j = await call<{ asset: import("@/lib/canvas/project-asset-types").ProjectAssetRecord }>(
    base,
    `/api/canvas/project-assets/${encodeURIComponent(assetId)}/lease`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "acquire", force: opts?.force }),
    },
  );
  return j.asset;
}

export async function releaseProjectAssetLease(
  base: string,
  assetId: string,
): Promise<void> {
  await call(
    base,
    `/api/canvas/project-assets/${encodeURIComponent(assetId)}/lease`,
    { method: "DELETE" },
  );
}

export async function mapProjectAssetInsert(
  base: string,
  assetId: string,
  edition: "pro" | "pro2" | "sbv1" | "standard",
): Promise<import("@/lib/canvas/project-asset-types").InsertMapResult> {
  const j = await call<{ insert: import("@/lib/canvas/project-asset-types").InsertMapResult }>(
    base,
    `/api/canvas/project-assets/${encodeURIComponent(assetId)}/insert-map`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edition }),
    },
  );
  return j.insert;
}
