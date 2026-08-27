/**
 * 浏览器侧 canvas API 客户端：统一处理跨域代理与 cookie。
 */
import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import {
  isCanvasToolsSessionUnauthorized,
  refreshCanvasToolsSessionClient,
} from "@/lib/canvas-tools-session-client";
import { ensureCanvasUploadFileMeta } from "@/lib/canvas/normalize-canvas-image-file";
import { recordCanvasApiTransfer } from "@/lib/canvas/use-canvas-network-status";
import {
  isTransientDbApiError,
  isTransientNetworkFetchError,
  sleepMs,
  transientDbRetryDelayMs,
} from "@/lib/fetch-with-db-retry";

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

export function isCanvasApiConflictError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /\b409\b/.test(msg) || /\bCONFLICT\b/i.test(msg);
}

/** 409 响应 message 中嵌入的服务端 updatedAt（见 book-mall canvas-delta-merge） */
export function parseCanvasConflictUpdatedAt(e: unknown): string | undefined {
  const msg = e instanceof Error ? e.message : String(e);
  const m = /\|(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\b/.exec(msg);
  return m?.[1];
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
  /** sbv1 · 列表封面媒体类型 */
  coverMediaKind?: "image" | "video";
  /** sbv1 · 悬停播放的成片 URL */
  coverVideoUrl?: string;
  /** sbv1 · 成片静态封面 */
  coverPosterUrl?: string;
  /** 已绑定脚本包 / 公告栏的协同画布，禁止删除 */
  collaborationLocked?: boolean;
  /** 列表接口可选 · 用于退役 Pro2 画布过滤 */
  meta?: unknown;
  nodeTypes?: string[] | null;
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
  polishMode?: "frame" | "video" | "both";
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
  /** 列表 API 解析后的主预览 URL（视频/图片） */
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  previewKind?: "image" | "video" | null;
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
  if (t.includes("save_wait_timeout")) {
    return "上一轮保存尚未结束，本次未再发起请求。请稍候或点手动保存。";
  }
  if (t.includes("save_timeout")) {
    return "主站保存响应超时（非浏览器网络断开）。多半是任务轮询占满连接，请稍后重试。";
  }
  if (/operation was aborted|The user aborted|AbortError/i.test(t)) {
    return "主站保存请求已取消（超时保护，非网络断开）。请稍后重试。";
  }
  if (t.includes("DATABASE_UNAVAILABLE") || t.includes("503")) {
    return "服务繁忙，请稍后再试";
  }
  if (t.includes("401") || t.includes("UNAUTHORIZED")) {
    return "登录连接已断开，正在自动重连；若操作仍失败请点「重新连接」。";
  }
  if (t.includes("缺少 Bearer Token") || t.includes("无效或过期的工具令牌")) {
    return "登录连接已断开，请刷新页面或重新从主站进入画布。";
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
  if (isTransientNetworkFetchError(t)) {
    return "无法连接主站 book-mall（:3000）或请求被中断。请确认 pnpm dev:all 正常，而非出口网络故障。";
  }
  if (/<!DOCTYPE html>/i.test(t) || /<html[\s>]/i.test(t)) {
    if (/\b404\b/.test(t)) {
      return "保存接口未找到（404）。请确认 book-mall（:3000）与 canvas-web（:3004）均在运行；若刚执行过 build，请重启 dev:all 或删除 canvas-web/.next 后重试。";
    }
    if (/\b500\b/.test(t)) {
      return "画布服务内部错误（500）。请确认 book-mall（:3000）与 canvas-web（:3004）均在运行；查看 book-mall 终端日志；若刚 build 过，重启 dev:all 或删除 canvas-web/.next 后重试。";
    }
    return "服务器返回了异常页面而非 JSON，请重启 canvas-web / book-mall 开发服务后重试。";
  }
  if (/\b500\b/.test(t) && !t.includes("INTERNAL_ERROR")) {
    return "主站 book-mall 保存失败（500）。请查看 book-mall 终端日志，确认数据库连接正常后重试。";
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
  const maxAttempts = 4;
  let sessionRefreshAttempted = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (i.signal?.aborted) {
      throw new Error("The operation was aborted");
    }
    let r: Response;
    let raw: string;
    const startedAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    try {
      r = await fetch(url, i);
      raw = await r.text();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (i.signal?.aborted) {
        throw new Error(msg || "The operation was aborted");
      }
      if (attempt < maxAttempts - 1 && isTransientNetworkFetchError(msg)) {
        await sleepMs(transientDbRetryDelayMs(attempt));
        continue;
      }
      throw new Error(msg);
    }
    const elapsedMs =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      startedAt;
    const bodyBytes =
      typeof i.body === "string"
        ? new TextEncoder().encode(i.body).length
        : 0;
    recordCanvasApiTransfer(bodyBytes + raw.length, elapsedMs);
    if (!r.ok) {
      const msg = sanitizeCanvasApiErrorBody(r.status, raw);
      if (
        typeof window !== "undefined" &&
        !sessionRefreshAttempted &&
        isCanvasToolsSessionUnauthorized(msg, r.status)
      ) {
        sessionRefreshAttempted = true;
        const refreshed = await refreshCanvasToolsSessionClient({ silent: true });
        if (refreshed) continue;
      }
      if (
        attempt < maxAttempts - 1 &&
        isTransientDbApiError(r.status, msg)
      ) {
        await sleepMs(transientDbRetryDelayMs(attempt));
        continue;
      }
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

  throw new Error("503 服务繁忙，请稍后再试");
}

// ── projects ──

export type CanvasProjectListPage = {
  projects: CanvasProjectSummary[];
  nextCursor: string | null;
  hasMore: boolean;
};

export async function listMyCanvasProjects(
  base: string,
  opts?: { limit?: number; cursor?: string | null },
): Promise<CanvasProjectListPage> {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  const j = await call<CanvasProjectListPage>(
    base,
    `/api/canvas/projects${qs ? `?${qs}` : ""}`,
  );
  return {
    projects: Array.isArray(j.projects) ? j.projects : [],
    nextCursor: j.nextCursor ?? null,
    hasMore: Boolean(j.hasMore),
  };
}

/** 需要全量列表的入口（资产页 / 剧本包扫描）· 分页合并，避免单次 200 条 */
export async function listAllMyCanvasProjects(
  base: string,
  opts?: { pageSize?: number; maxItems?: number },
): Promise<CanvasProjectSummary[]> {
  const pageSize = opts?.pageSize ?? 50;
  const maxItems = opts?.maxItems ?? 200;
  const out: CanvasProjectSummary[] = [];
  let cursor: string | null = null;
  while (out.length < maxItems) {
    const page = await listMyCanvasProjects(base, {
      limit: pageSize,
      cursor,
    });
    out.push(...page.projects);
    if (!page.hasMore || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out.slice(0, maxItems);
}

export type PortalFeaturedProjectSummary = CanvasProjectSummary & {
  portalFeaturedBlurb: string;
  owner?: { id: string; name: string | null; email: string | null } | null;
};

/** 门户首页 · 精选示例项目（与「我的画布」同源 thumbnailUrl） */
export async function listPortalFeaturedProjects(
  base: string,
  init?: RequestInit,
): Promise<PortalFeaturedProjectSummary[]> {
  const j = await call<{ projects: PortalFeaturedProjectSummary[] }>(
    base,
    "/api/canvas/projects/portal-featured",
    init,
  );
  return Array.isArray(j.projects) ? j.projects : [];
}

/** 从门户示例复制到当前用户画布 */
export async function duplicatePortalFeaturedProject(
  base: string,
  id: string,
): Promise<CanvasProjectDetail> {
  const j = await call<{ project: CanvasProjectDetail }>(
    base,
    `/api/canvas/projects/portal-featured/${id}/duplicate`,
    { method: "POST" },
  );
  return j.project;
}

/** 管理员 · 设置/取消门户精选 */
export async function patchPortalFeaturedProject(
  base: string,
  id: string,
  patch: { featured: boolean; sort?: number; blurb?: string },
): Promise<PortalFeaturedProjectSummary> {
  const j = await call<{ project: PortalFeaturedProjectSummary }>(
    base,
    `/api/canvas/projects/${id}/portal-featured`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  return j.project;
}

export type PortalCaseProjectSummary = CanvasProjectSummary & {
  portalCaseBlurb: string;
  owner?: { id: string; name: string | null; email: string | null } | null;
};

export type PortalFilmShowcaseMedia = {
  id: string;
  url: string;
  kind: "image" | "video";
  posterUrl?: string;
  sourceKind: "project" | "template";
  sourceId: string;
  projectName: string;
  description: string;
  owner?: { id: string; name: string | null; email: string | null } | null;
};

export type CanvasPortalPublishKind =
  | "CASE"
  | "FEATURED"
  | "TEMPLATE"
  | "PUBLIC_TEMPLATE";

export type PortalSubmissionRecord = {
  id: string;
  projectId: string;
  userId: string;
  status: string;
  requestKind: CanvasPortalPublishKind;
  userNote: string;
  adminNote: string;
  reviewedAt: string | null;
  approvedKind: CanvasPortalPublishKind | null;
  createdAt: string;
  project: {
    id: string;
    name: string;
    thumbnailUrl: string;
    edition: CanvasProjectSummary["edition"];
  };
  user: { id: string; name: string | null; email: string | null };
};

/** 门户首页 · 影视案例媒体墙（sbv1 已入库图/视频） */
export async function listPortalFilmShowcase(
  base: string,
  limit?: number,
): Promise<PortalFilmShowcaseMedia[]> {
  const qs =
    typeof limit === "number" && Number.isFinite(limit)
      ? `?limit=${encodeURIComponent(String(limit))}`
      : "";
  const j = await call<{ items: PortalFilmShowcaseMedia[] }>(
    base,
    `/api/canvas/projects/portal-film-showcase${qs}`,
  );
  return Array.isArray(j.items) ? j.items : [];
}

export async function duplicatePortalFilmShowcaseProject(
  base: string,
  id: string,
): Promise<CanvasProjectDetail> {
  const j = await call<{ project: CanvasProjectDetail }>(
    base,
    `/api/canvas/projects/portal-film-showcase/${id}/duplicate`,
    { method: "POST" },
  );
  return j.project;
}

/** 门户首页 · 案例墙（edition=sbv1 为分镜视频 1.0 影视案例） */
export async function listPortalCaseProjects(
  base: string,
  edition?: "pro2" | "sbv1",
  init?: RequestInit,
): Promise<PortalCaseProjectSummary[]> {
  const qs =
    edition === "pro2" || edition === "sbv1"
      ? `?edition=${encodeURIComponent(edition)}`
      : "";
  const j = await call<{ projects: PortalCaseProjectSummary[] }>(
    base,
    `/api/canvas/projects/portal-cases${qs}`,
    init,
  );
  return Array.isArray(j.projects) ? j.projects : [];
}

export async function duplicatePortalCaseProject(
  base: string,
  id: string,
): Promise<CanvasProjectDetail> {
  const j = await call<{ project: CanvasProjectDetail }>(
    base,
    `/api/canvas/projects/portal-cases/${id}/duplicate`,
    { method: "POST" },
  );
  return j.project;
}

/** 管理员 · 设置/取消门户案例 */
export async function patchPortalCaseProject(
  base: string,
  id: string,
  patch: { case: boolean; sort?: number; blurb?: string },
): Promise<PortalCaseProjectSummary> {
  const j = await call<{ project: PortalCaseProjectSummary }>(
    base,
    `/api/canvas/projects/${id}/portal-case`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  return j.project;
}

/** 用户 · 提交作品 / 发布（模板即时；精选/案例审核；管理员全部即时） */
export async function submitCanvasPortalReview(
  base: string,
  projectId: string,
  body: { requestKind: CanvasPortalPublishKind; userNote?: string },
): Promise<{ appliedImmediately: boolean; submission?: PortalSubmissionRecord }> {
  const j = await call<{
    appliedImmediately?: boolean;
    submission?: PortalSubmissionRecord;
  }>(base, `/api/canvas/projects/${projectId}/portal-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    appliedImmediately: Boolean(j.appliedImmediately),
    submission: j.submission,
  };
}

export async function listPortalSubmissions(
  base: string,
  status: "PENDING" | "APPROVED" | "REJECTED" = "PENDING",
): Promise<PortalSubmissionRecord[]> {
  const j = await call<{ submissions: PortalSubmissionRecord[] }>(
    base,
    `/api/canvas/admin/portal-submissions?status=${encodeURIComponent(status)}`,
  );
  return Array.isArray(j.submissions) ? j.submissions : [];
}

export async function reviewPortalSubmission(
  base: string,
  submissionId: string,
  body: {
    approve: boolean;
    approvedKind?: CanvasPortalPublishKind;
    adminNote?: string;
  },
): Promise<PortalSubmissionRecord> {
  const j = await call<{ submission: PortalSubmissionRecord }>(
    base,
    `/api/canvas/admin/portal-submissions/${submissionId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return j.submission;
}

export type AdminPortalProjectPreview = {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  edition: CanvasProjectSummary["edition"];
  portalFeatured: boolean;
  portalCase: boolean;
  portalFilmCase: boolean;
  portalFeaturedBlurb: string;
  portalCaseBlurb: string;
  canvas: unknown;
  owner?: { id: string; name: string | null; email: string | null } | null;
};

export type AdminPortalFilmProjectSummary = PortalCaseProjectSummary & {
  portalFilmCase: boolean;
  portalFilmCaseSort: number;
  mediaCount: number;
};

export async function listAdminPortalFilmProjects(
  base: string,
): Promise<AdminPortalFilmProjectSummary[]> {
  const j = await call<{ projects: AdminPortalFilmProjectSummary[] }>(
    base,
    "/api/canvas/admin/portal-film-projects",
  );
  return Array.isArray(j.projects) ? j.projects : [];
}

export async function getAdminPortalProjectPreview(
  base: string,
  projectId: string,
): Promise<AdminPortalProjectPreview> {
  const j = await call<{ project: AdminPortalProjectPreview }>(
    base,
    `/api/canvas/admin/portal-projects/${projectId}`,
  );
  return j.project;
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

/** 仅拉 updatedAt（乐观锁对齐），避免全量 canvas JSON 打满连接池 */
export async function getCanvasProjectUpdatedAt(
  base: string,
  id: string,
): Promise<string> {
  const j = await call<{ updatedAt: string }>(
    base,
    `/api/canvas/projects/${id}/updated-at`,
  );
  return j.updatedAt;
}

const projectDetailCache = new Map<
  string,
  { at: number; data: CanvasProjectDetail }
>();
const projectDetailInflight = new Map<
  string,
  Promise<CanvasProjectDetail>
>();
const PROJECT_DETAIL_CACHE_TTL_MS = 90_000;

function projectCacheKey(base: string, id: string): string {
  return `${base.replace(/\/$/, "")}:${id}`;
}

function isProjectDetailCacheFresh(key: string): boolean {
  const hit = projectDetailCache.get(key);
  return Boolean(hit && Date.now() - hit.at < PROJECT_DETAIL_CACHE_TTL_MS);
}

/** 列表 hover / pointerdown 预取 · 进入画布时若命中缓存可秒开 */
export function prefetchCanvasProject(base: string, id: string): void {
  if (!base?.trim() || !id?.trim()) return;
  const key = projectCacheKey(base, id);
  if (isProjectDetailCacheFresh(key) || projectDetailInflight.has(key)) return;
  void getCanvasProjectCached(base, id).catch(() => undefined);
}

/**
 * 批量预取项目详情（全量 canvas JSON）。
 * 默认最多预取前 `limit` 个且并发 1，避免打满腾讯云连接池。
 * 列表页请勿对全部项目调用；优先用单条 prefetchCanvasProject（hover）。
 */
export function prefetchCanvasProjects(
  base: string,
  ids: string[],
  opts?: { limit?: number; maxConcurrent?: number },
): void {
  if (!base?.trim() || ids.length === 0) return;
  const limit = Math.max(0, opts?.limit ?? 3);
  const maxConcurrent = Math.max(1, opts?.maxConcurrent ?? 1);
  const pending = ids
    .filter((id) => {
      if (!id?.trim()) return false;
      const key = projectCacheKey(base, id);
      return !isProjectDetailCacheFresh(key) && !projectDetailInflight.has(key);
    })
    .slice(0, limit);
  if (pending.length === 0) return;

  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const id = pending[cursor++];
      await getCanvasProjectCached(base, id).catch(() => undefined);
    }
  };
  for (let i = 0; i < Math.min(maxConcurrent, pending.length); i++) {
    void worker();
  }
}

export async function getCanvasProjectCached(
  base: string,
  id: string,
): Promise<CanvasProjectDetail> {
  const key = projectCacheKey(base, id);
  const hit = projectDetailCache.get(key);
  if (hit && Date.now() - hit.at < PROJECT_DETAIL_CACHE_TTL_MS) {
    return hit.data;
  }
  const inflight = projectDetailInflight.get(key);
  if (inflight) return inflight;

  const promise = getCanvasProject(base, id)
    .then((project) => {
      projectDetailCache.set(key, { at: Date.now(), data: project });
      return project;
    })
    .finally(() => {
      projectDetailInflight.delete(key);
    });
  projectDetailInflight.set(key, promise);
  return promise;
}

export function invalidateCanvasProjectCache(base: string, id: string): void {
  const key = projectCacheKey(base, id);
  projectDetailCache.delete(key);
  projectDetailInflight.delete(key);
}

/**
 * 仅丢弃卡住的 in-flight 预取，保留已成功写入的详情缓存。
 * 打开大剧本画布时：列表 hover 已拉过 JSON，编辑器应命中缓存，勿再清缓存重拉。
 */
export function abandonCanvasProjectInflight(base: string, id: string): void {
  projectDetailInflight.delete(projectCacheKey(base, id));
}

/** 编辑器首屏拉取成功后写入缓存，供后续 updatedAt / 二次进入复用 */
export function seedCanvasProjectDetailCache(
  base: string,
  id: string,
  project: CanvasProjectDetail,
): void {
  projectDetailCache.set(projectCacheKey(base, id), {
    at: Date.now(),
    data: project,
  });
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
  /** 画布视口截图（OSS）；缺省时服务端回退到项目封面 / 画布内媒体图 */
  thumbnailUrl?: string;
};

export async function patchCanvasProject(
  base: string,
  id: string,
  patch: {
    name?: string;
    description?: string;
    canvas?: unknown;
    canvasDelta?: import("@/lib/canvas/canvas-persist-delta").CanvasDeltaPatch;
    thumbnailUrl?: string;
    historySnapshot?: CanvasProjectHistorySnapshotRequest;
  },
  opts?: { signal?: AbortSignal },
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
    signal: opts?.signal,
  });
  projectDetailCache.set(projectCacheKey(base, id), {
    at: Date.now(),
    data: j.project,
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

export type CanvasPromptHistoryItem = {
  id: string;
  projectId: string;
  projectName?: string;
  nodeId: string;
  promptText: string;
  mediaKind: "TEXT" | "IMAGE" | "VIDEO";
  status: "SUCCEEDED" | "FAILED";
  modelLabel: string;
  providerLabel: string;
  failMessage: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type CanvasPromptHistoryPage = {
  items: CanvasPromptHistoryItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

export async function listProjectPromptHistory(
  base: string,
  projectId: string,
  filters?: {
    mediaKind?: CanvasPromptHistoryItem["mediaKind"];
    outcome?: "success" | "failed";
    limit?: number;
    cursor?: string | null;
  },
): Promise<CanvasPromptHistoryPage> {
  const qs = new URLSearchParams();
  if (filters?.mediaKind) qs.set("mediaKind", filters.mediaKind);
  if (filters?.outcome) qs.set("outcome", filters.outcome);
  if (filters?.limit != null) qs.set("limit", String(filters.limit));
  if (filters?.cursor) qs.set("cursor", filters.cursor);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const j = await call<CanvasPromptHistoryPage>(
    base,
    `/api/canvas/projects/${projectId}/prompt-history${suffix}`,
  );
  return {
    items: j.items ?? [],
    hasMore: j.hasMore ?? false,
    nextCursor: j.nextCursor ?? null,
  };
}

export async function listUserPromptHistory(
  base: string,
  filters?: {
    mediaKind?: CanvasPromptHistoryItem["mediaKind"];
    outcome?: "success" | "failed";
    limit?: number;
    cursor?: string | null;
  },
): Promise<CanvasPromptHistoryPage> {
  const qs = new URLSearchParams();
  if (filters?.mediaKind) qs.set("mediaKind", filters.mediaKind);
  if (filters?.outcome) qs.set("outcome", filters.outcome);
  if (filters?.limit != null) qs.set("limit", String(filters.limit));
  if (filters?.cursor) qs.set("cursor", filters.cursor);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const j = await call<CanvasPromptHistoryPage>(
    base,
    `/api/canvas/prompt-history${suffix}`,
  );
  return {
    items: j.items ?? [],
    hasMore: j.hasMore ?? false,
    nextCursor: j.nextCursor ?? null,
  };
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
  opts?: {
    projectLimit?: number;
    projectCursor?: string | null;
    todayLimit?: number;
    todayCursor?: string | null;
  },
): Promise<{
  projectTasks: CanvasGenerationRecord[];
  todayTasks: CanvasGenerationRecord[];
  projectHasMore: boolean;
  projectNextCursor: string | null;
  todayHasMore: boolean;
  todayNextCursor: string | null;
  since: string;
}> {
  const qs = new URLSearchParams();
  if (opts?.projectLimit != null) qs.set("projectLimit", String(opts.projectLimit));
  if (opts?.projectCursor) qs.set("projectCursor", opts.projectCursor);
  if (opts?.todayLimit != null) qs.set("todayLimit", String(opts.todayLimit));
  if (opts?.todayCursor) qs.set("todayCursor", opts.todayCursor);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const j = await call<{
    projectTasks: CanvasGenerationRecord[];
    todayTasks: CanvasGenerationRecord[];
    projectHasMore?: boolean;
    projectNextCursor?: string | null;
    todayHasMore?: boolean;
    todayNextCursor?: string | null;
    since: string;
  }>(base, `/api/canvas/projects/${projectId}/generation-records${suffix}`);
  return {
    projectTasks: j.projectTasks ?? [],
    todayTasks: j.todayTasks ?? [],
    projectHasMore: j.projectHasMore ?? false,
    projectNextCursor: j.projectNextCursor ?? null,
    todayHasMore: j.todayHasMore ?? false,
    todayNextCursor: j.todayNextCursor ?? null,
    since: j.since,
  };
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
      audioInputs?: string[];
      textInputs?: string[];
      portraitAssetRefs?: Array<{
        url: string;
        role?: "reference_image" | "first_frame" | "last_frame";
      }>;
    };
    /** 阶段 4：跳过缓存，强制创建新任务（"重新生成"） */
    forceFresh?: boolean;
    llmSection?: "outline" | "character" | "scene" | "storyboard" | "shot_prompts";
    rowKey?: string;
    polishMode?: "frame" | "video" | "both";
    mediaKind?:
      | "threeView"
      | "frameImage"
      | "video"
      | "tts"
      | "sceneRef"
      | "themeOutline"
      | "generalText"
      | "music";
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

/** 用户主动中止进行中的生成任务（服务端可能已完成并计费）。 */
export async function cancelCanvasGenerationTask(
  base: string,
  projectId: string,
  taskId: string,
): Promise<{ ok: true; alreadyTerminal: boolean }> {
  return call<{ ok: true; alreadyTerminal: boolean }>(
    base,
    `/api/canvas/projects/${projectId}/tasks/${taskId}/cancel`,
    { method: "POST" },
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

export type CanvasBackgroundVideoTaskRow = {
  taskId: string;
  nodeId: string;
  status: string;
  failCode: string | null;
  gatewayLogId: string | null;
  gatewayStatus: string | null;
  vendorTaskId: string | null;
  submittedAt: string;
  ageSec: number;
  kind: "background_generating" | "recoverable_stall" | "ready_to_load";
  label: string;
  hint: string;
  canRecover: boolean;
};

export async function listCanvasBackgroundVideoTasks(
  base: string,
  projectId: string,
): Promise<{ tasks: CanvasBackgroundVideoTaskRow[]; config: { backgroundLabel: string } }> {
  return call(base, `/api/canvas/projects/${projectId}/background-video-tasks`);
}

export async function recoverCanvasBackgroundVideoTask(
  base: string,
  projectId: string,
  taskId: string,
): Promise<{ ok: boolean; result: { ok: boolean; action: string; reason?: string } }> {
  return call(base, `/api/canvas/projects/${projectId}/background-video-tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId }),
  });
}

// ── uploads ──

export async function uploadCanvasImage(
  base: string,
  file: File,
): Promise<string> {
  return uploadCanvasFile(base, ensureCanvasUploadFileMeta(file));
}

const UPLOAD_FETCH_TIMEOUT_MS = 120_000;
const UPLOAD_VIDEO_FETCH_TIMEOUT_MS = 600_000;

export async function uploadCanvasVideo(
  base: string,
  file: File,
): Promise<string> {
  return uploadCanvasFile(base, file, UPLOAD_VIDEO_FETCH_TIMEOUT_MS);
}

export async function uploadCanvasFile(
  base: string,
  file: File,
  timeoutMs = UPLOAD_FETCH_TIMEOUT_MS,
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { url, init } = resolveBookMallBrowserRequest(
    base,
    "/api/canvas/uploads",
    { method: "POST", body: form },
  );
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    timeoutMs,
  );
  let r: Response;
  try {
    r = await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("upload failed: 上传超时，请检查网络后重试");
    }
    throw e;
  } finally {
    window.clearTimeout(timeoutId);
  }
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

export async function cropCanvasGridSplitCell(
  base: string,
  body: {
    projectId: string;
    imageUrl: string;
    col: number;
    row: number;
    cols: number;
    rows: number;
  },
): Promise<string> {
  const { url, init } = resolveBookMallBrowserRequest(
    base,
    "/api/canvas/grid-split/crop-cell",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
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
    throw new Error(`grid split crop failed: ${detail}`);
  }
  const j = (await r.json()) as { ossUrl?: string };
  if (!j.ossUrl?.trim()) throw new Error("grid split crop missing ossUrl");
  return j.ossUrl.trim();
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
  /** 与项目列表 thumbnailUrl 同源（服务端从 canvas 回填） */
  thumbnailUrl?: string;
  description?: string;
  visibility?: string;
  featured?: boolean;
  edition?: string;
  forkCount?: number;
  sourceLabel?: string;
  builtin: boolean;
  ownerUserId: string | null;
  canvas: unknown;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; name: string | null; email: string | null } | null;
};

export async function listCanvasTemplates(
  base: string,
  scope?: "featured" | "public" | "my" | "all",
  init?: RequestInit,
): Promise<CanvasTemplateRecord[]> {
  const qs = scope && scope !== "all" ? `?scope=${encodeURIComponent(scope)}` : "";
  const j = await call<{ templates: CanvasTemplateRecord[] }>(
    base,
    `/api/canvas/templates${qs}`,
    init,
  );
  return Array.isArray(j.templates) ? j.templates : [];
}

export async function saveCanvasTemplate(
  base: string,
  args: {
    name: string;
    canvas: unknown;
    category?: string;
    thumbnail?: string;
    description?: string;
    edition?: string;
    sourceLabel?: string;
    visibility?: "private" | "public";
  },
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

export async function patchCanvasTemplate(
  base: string,
  id: string,
  patch: {
    name?: string;
    description?: string;
    visibility?: "private" | "public";
  },
): Promise<CanvasTemplateRecord> {
  const j = await call<{ template: CanvasTemplateRecord }>(
    base,
    `/api/canvas/templates/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  return j.template;
}

export async function deleteCanvasTemplate(
  base: string,
  id: string,
): Promise<void> {
  await call(base, `/api/canvas/templates/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function forkCanvasTemplate(
  base: string,
  id: string,
): Promise<CanvasTemplateRecord> {
  const j = await call<{ template: CanvasTemplateRecord }>(
    base,
    `/api/canvas/templates/${encodeURIComponent(id)}/fork`,
    { method: "POST" },
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
  localDownloadPath?: string | null;
  uploadFailed?: boolean;
  posterUrl: string | null;
  expiresAt: string;
  errorMessage: string | null;
};

export function resolveMediaRenderDownloadUrl(
  base: string,
  job: Pick<MediaRenderJob, "downloadUrl" | "localDownloadPath" | "id">,
): string | null {
  if (job.downloadUrl?.trim()) return job.downloadUrl.trim();
  if (job.localDownloadPath?.trim()) {
    const { url } = resolveBookMallBrowserRequest(base, job.localDownloadPath, {
      method: "GET",
    });
    return url;
  }
  return null;
}

import type { SubtitleBurnInStyle } from "@private/media-render-subtitle-style/subtitle-style-options";

export type MediaRenderScaleMode = "source" | "fit720p" | "fit1080p";

export type MediaRenderProfile = {
  transition?: { type: "xfade"; durationSec: number } | { type: "none" };
  subtitle?: {
    mode: "script" | "asr" | "none";
    burnIn?: boolean;
    asrModelKey?: string;
    style?: SubtitleBurnInStyle;
  };
  video?: { scaleMode?: MediaRenderScaleMode };
};

const MEDIA_RENDER_FETCH_RETRIES = 4;
const MEDIA_RENDER_FETCH_RETRY_MS = 1_500;
const MEDIA_RENDER_FETCH_TIMEOUT_MS = 120_000;

function isTransientMediaRenderFetchError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /fetch failed|failed to fetch|network|econnreset|etimedout|abort|timeout/i.test(
    msg,
  );
}

function parseMediaRenderApiError(
  data: { message?: string; error?: string } | null | undefined,
  status: number,
): string {
  const message = data?.message?.trim();
  if (message) return message;
  if (data?.error === "book_mall_proxy_failed") {
    return "主站连接失败，请稍后重试";
  }
  if (data?.error === "book_mall_url_missing") {
    return "未配置主站地址，无法提交剪辑任务";
  }
  return `剪辑请求失败 HTTP ${status}`;
}

async function fetchMediaRenderApi(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let sessionRefreshAttempted = false;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MEDIA_RENDER_FETCH_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        MEDIA_RENDER_FETCH_TIMEOUT_MS,
      );
      let response: Response;
      try {
        response = await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (
        response.status === 401 &&
        !sessionRefreshAttempted &&
        typeof window !== "undefined"
      ) {
        sessionRefreshAttempted = true;
        const refreshed = await refreshCanvasToolsSessionClient({ silent: true });
        if (refreshed) {
          attempt -= 1;
          continue;
        }
      }
      if (
        response.status >= 502 &&
        response.status <= 504 &&
        attempt < MEDIA_RENDER_FETCH_RETRIES
      ) {
        await sleepMs(MEDIA_RENDER_FETCH_RETRY_MS * attempt);
        continue;
      }
      return response;
    } catch (err) {
      lastErr = err;
      if (isTransientMediaRenderFetchError(err) && attempt < MEDIA_RENDER_FETCH_RETRIES) {
        await sleepMs(MEDIA_RENDER_FETCH_RETRY_MS * attempt);
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}

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
  const r = await fetchMediaRenderApi(url, init);
  const data = (await r.json().catch(() => ({}))) as {
    job?: MediaRenderJob;
    message?: string;
    error?: string;
  };
  if (!r.ok) {
    throw new Error(parseMediaRenderApiError(data, r.status));
  }
  if (!data.job) throw new Error("invalid render response");
  return data.job;
}

export async function pollMediaRender(
  base: string,
  jobId: string,
  opts?: { retries?: number },
): Promise<MediaRenderJob> {
  const maxAttempts = Math.max(1, opts?.retries ?? 3);
  let lastError = "poll failed";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { url, init } = resolveBookMallBrowserRequest(
      base,
      `/api/canvas/media/render/${encodeURIComponent(jobId)}`,
      { method: "GET" },
    );
    const r = await fetchMediaRenderApi(url, init);
    const data = (await r.json().catch(() => ({}))) as {
      job?: MediaRenderJob;
      message?: string;
      error?: string;
    };
    if (r.ok && data.job) return data.job;
    lastError = data.message ?? parseMediaRenderApiError(data, r.status);
    if ((r.status >= 500 || r.status === 502) && attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
      continue;
    }
    throw new Error(lastError);
  }
  throw new Error(lastError);
}

export async function retryMediaRenderUpload(
  base: string,
  jobId: string,
): Promise<MediaRenderJob> {
  const { url, init } = resolveBookMallBrowserRequest(
    base,
    `/api/canvas/media/render/${encodeURIComponent(jobId)}/retry-upload`,
    { method: "POST" },
  );
  const r = await fetchMediaRenderApi(url, init);
  const data = (await r.json().catch(() => ({}))) as {
    job?: MediaRenderJob;
    message?: string;
    error?: string;
  };
  if (!r.ok || !data.job) {
    throw new Error(parseMediaRenderApiError(data, r.status));
  }
  return data.job;
}

/** 用户主动中止进行中的云端剪辑（FFmpeg 可能仍在跑）。 */
export async function cancelMediaRenderJob(
  base: string,
  jobId: string,
): Promise<{ ok: true; alreadyTerminal: boolean }> {
  const { url, init } = resolveBookMallBrowserRequest(
    base,
    `/api/canvas/media/render/${encodeURIComponent(jobId)}`,
    { method: "DELETE" },
  );
  const r = await fetchMediaRenderApi(url, init);
  const data = (await r.json().catch(() => ({}))) as {
    ok?: boolean;
    alreadyTerminal?: boolean;
    message?: string;
    error?: string;
  };
  if (!r.ok) {
    throw new Error(parseMediaRenderApiError(data, r.status));
  }
  return { ok: true, alreadyTerminal: Boolean(data.alreadyTerminal) };
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
  // 默认 2.5s：DB 紧张时 1.5s 轮询会与 tasks/保存叠压
  let intervalMs = opts?.intervalMs ?? 2500;
  const timeoutMs = opts?.timeoutMs ?? 15 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;
  let lastJob: MediaRenderJob | null = null;
  let consecutivePollErrors = 0;
  while (Date.now() < deadline) {
    const pollStarted = Date.now();
    try {
      const job = await pollMediaRender(base, jobId);
      lastJob = job;
      consecutivePollErrors = 0;
      opts?.onPoll?.(job);
      if (
        job.status === "SUCCEEDED" ||
        job.status === "FAILED" ||
        job.status === "EXPIRED"
      ) {
        return job;
      }
      if (job.uploadFailed && job.localDownloadPath) {
        return job;
      }
      const pollMs = Date.now() - pollStarted;
      if (pollMs > 4000) {
        intervalMs = Math.min(8000, Math.max(intervalMs, Math.floor(pollMs * 0.8)));
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    } catch (e) {
      consecutivePollErrors += 1;
      intervalMs = Math.min(8000, intervalMs + 1000);
      const message = e instanceof Error ? e.message : String(e);
      if (
        lastJob?.localDownloadPath &&
        (lastJob.uploadFailed || consecutivePollErrors >= 3)
      ) {
        return {
          ...lastJob,
          uploadFailed: true,
          errorMessage:
            lastJob.errorMessage ??
            friendlyMediaRenderPollErrorMessage(message),
        };
      }
      if (consecutivePollErrors >= 24) {
        throw new Error(friendlyMediaRenderPollErrorMessage(message));
      }
      const backoffMs = Math.min(
        20_000,
        intervalMs * Math.min(consecutivePollErrors, 6),
      );
      opts?.onPoll?.({
        ...(lastJob ?? {
          id: jobId,
          status: "RUNNING" as const,
          progress: 0,
          progressLabel: "连接中断，正在重试…",
          downloadUrl: null,
          localDownloadPath: null,
          uploadFailed: false,
          posterUrl: null,
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          errorMessage: null,
        }),
        progressLabel:
          lastJob?.progressLabel?.trim() || "连接中断，正在重试…",
      });
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  if (lastJob?.localDownloadPath) {
    return {
      ...lastJob,
      uploadFailed: true,
      errorMessage: lastJob.errorMessage ?? "云端同步超时，可下载本地成片后重试",
    };
  }
  throw new Error("云端剪辑超时，请稍后重试");
}

function friendlyMediaRenderPollErrorMessage(message: string): string {
  if (/book_mall_proxy|502|503|500|abort|timeout/i.test(message)) {
    return "进度查询暂时失败，成片若已生成可直接下载；稍后可重试云端同步。";
  }
  return message;
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
    limit?: number;
    cursor?: string | null;
  },
): Promise<{
  assets: import("@/lib/canvas/project-asset-types").ProjectAssetRecord[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const sp = new URLSearchParams();
  if (opts?.projectId) sp.set("projectId", opts.projectId);
  if (opts?.kind) sp.set("kind", opts.kind);
  if (opts?.scope) sp.set("scope", opts.scope);
  if (opts?.visibility) sp.set("visibility", opts.visibility);
  if (opts?.q) sp.set("q", opts.q);
  if (opts?.limit != null) sp.set("limit", String(opts.limit));
  if (opts?.cursor) sp.set("cursor", opts.cursor);
  const q = sp.toString();
  const j = await call<{
    assets: import("@/lib/canvas/project-asset-types").ProjectAssetRecord[];
    hasMore?: boolean;
    nextCursor?: string | null;
  }>(base, `/api/canvas/project-assets${q ? `?${q}` : ""}`);
  return {
    assets: j.assets ?? [],
    hasMore: j.hasMore ?? false,
    nextCursor: j.nextCursor ?? null,
  };
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

export async function fetchProjectAsset(
  base: string,
  assetId: string,
): Promise<import("@/lib/canvas/project-asset-types").ProjectAssetRecord> {
  const j = await call<{ asset: import("@/lib/canvas/project-asset-types").ProjectAssetRecord }>(
    base,
    `/api/canvas/project-assets/${encodeURIComponent(assetId)}`,
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
    payload?: Record<string, unknown>;
    /** 设为 null：提升为「我的空间可用」，跨画布可见 */
    sourceProjectId?: null;
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

export type {
  Pro2ActiveTemplatesSnapshot,
  Pro2HubPromptPackResolved,
  Pro2PromptBlock,
  Pro2PromptTemplatePassKind,
  Pro2PromptTemplateRecord,
  Pro2PromptTemplateRegistry,
  Pro2TemplatePackRecord,
} from "@/lib/canvas/pro2-prompt-template-types";

export async function listAdminPro2Templates(
  base: string,
  filter?: {
    registry?: import("@/lib/canvas/pro2-prompt-template-types").Pro2PromptTemplateRegistry;
    passKind?: import("@/lib/canvas/pro2-prompt-template-types").Pro2PromptTemplatePassKind;
    enabled?: boolean;
  },
): Promise<import("@/lib/canvas/pro2-prompt-template-types").Pro2PromptTemplateRecord[]> {
  const qs = new URLSearchParams();
  if (filter?.registry) qs.set("registry", filter.registry);
  if (filter?.passKind) qs.set("passKind", filter.passKind);
  if (filter?.enabled != null) qs.set("enabled", String(filter.enabled));
  const j = await call<{
    templates: import("@/lib/canvas/pro2-prompt-template-types").Pro2PromptTemplateRecord[];
  }>(base, `/api/canvas/admin/pro2-templates?${qs.toString()}`);
  return Array.isArray(j.templates) ? j.templates : [];
}

export async function patchAdminPro2Template(
  base: string,
  id: string,
  patch: Partial<{
    name: string;
    description: string | null;
    version: string;
    enabled: boolean;
    blocks: import("@/lib/canvas/pro2-prompt-template-types").Pro2PromptBlock[];
    sortOrder: number;
  }>,
): Promise<import("@/lib/canvas/pro2-prompt-template-types").Pro2PromptTemplateRecord> {
  const j = await call<{
    template: import("@/lib/canvas/pro2-prompt-template-types").Pro2PromptTemplateRecord;
  }>(base, `/api/canvas/admin/pro2-templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return j.template;
}

export async function deleteAdminPro2Template(base: string, id: string): Promise<void> {
  await call(base, `/api/canvas/admin/pro2-templates/${id}`, { method: "DELETE" });
}

export async function listAdminPro2TemplatePacks(
  base: string,
): Promise<import("@/lib/canvas/pro2-prompt-template-types").Pro2TemplatePackRecord[]> {
  const j = await call<{
    packs: import("@/lib/canvas/pro2-prompt-template-types").Pro2TemplatePackRecord[];
  }>(base, "/api/canvas/admin/pro2-template-packs");
  return Array.isArray(j.packs) ? j.packs : [];
}

export async function patchAdminPro2TemplatePack(
  base: string,
  id: string,
  patch: Partial<{
    name: string;
    enabled: boolean;
    categoryDocTitle: string | null;
    categoryDocBody: string | null;
    outlineTemplateId: string;
    characterTemplateId: string;
    sceneTemplateId: string;
    storyboardTemplateId: string;
    sortOrder: number;
  }>,
): Promise<import("@/lib/canvas/pro2-prompt-template-types").Pro2TemplatePackRecord> {
  const j = await call<{
    pack: import("@/lib/canvas/pro2-prompt-template-types").Pro2TemplatePackRecord;
  }>(base, `/api/canvas/admin/pro2-template-packs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return j.pack;
}

export async function fetchActivePro2Templates(
  base: string,
  packKey?: string,
): Promise<{
  snapshot: import("@/lib/canvas/pro2-prompt-template-types").Pro2ActiveTemplatesSnapshot;
  pack: import("@/lib/canvas/pro2-prompt-template-types").Pro2HubPromptPackResolved | null;
}> {
  const qs = packKey ? `?packKey=${encodeURIComponent(packKey)}` : "";
  return call(base, `/api/canvas/pro2-templates/active${qs}`);
}
