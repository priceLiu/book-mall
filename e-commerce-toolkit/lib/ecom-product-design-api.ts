"use client";

import { EcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  EcomImageRatio,
  EcomPlatformSpec,
  EcomProjectModule,
  ImageGenPlan,
  ImageGenPlanItem,
  ProductContext,
  ProductDesign,
  ProductDesignBrief,
  ProductDesignChatMessage,
  ProductDesignDesignPatch,
  ProductDesignProject,
  ProductDesignProjectSummary,
  ProductDesignReference,
  ProductDesignSettings,
  ProductDesignStrategyImport,
  ProductDesignVisualBriefEntry,
} from "@/lib/product-design-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const BASE = "api/sso/tools/ecom/product-design";
const SPECS_CACHE_KEY = "ecom-product-design-platform-specs";
const MODELS_CACHE_KEY = "ecom-product-design-models-cache";
const SPECS_CACHE_MS = 5 * 60 * 1000;
/** 模型清单：localStorage 持久化，减少每次打开工作台都拉 Gateway */
const MODELS_CACHE_MS = 30 * 60 * 1000;

function readCache<T>(key: string, ttlMs: number, storage: Storage = sessionStorage): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; data?: T };
    if (parsed.data && typeof parsed.at === "number" && Date.now() - parsed.at < ttlMs) {
      return parsed.data;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCache<T>(
  key: string,
  data: T,
  storage: Storage = sessionStorage,
): void {
  if (typeof window === "undefined") return;
  try {
    storage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* ignore */
  }
}

function isEmptyModelsPayload(data: {
  chatModels: StoryboardGatewayModel[];
  visionModels: StoryboardGatewayModel[];
  imageModels: StoryboardGatewayModel[];
}): boolean {
  return (
    data.chatModels.length === 0 &&
    data.visionModels.length === 0 &&
    data.imageModels.length === 0
  );
}

export async function fetchPlatformSpecs(): Promise<{
  specs: EcomPlatformSpec[];
  defaultPlatform: string;
}> {
  const cached = readCache<{ specs: EcomPlatformSpec[]; defaultPlatform: string }>(
    SPECS_CACHE_KEY,
    SPECS_CACHE_MS,
  );
  if (cached) return cached;

  const data = await ecomBookFetch(`${BASE}/platform-specs`);
  const result = {
    specs: (data.specs as EcomPlatformSpec[]) ?? [],
    defaultPlatform: (data.defaultPlatform as string) ?? "taobao-tmall",
  };
  writeCache(SPECS_CACHE_KEY, result);
  return result;
}

export function invalidateProductDesignModelsCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(MODELS_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export async function fetchProductDesignModels(opts?: {
  force?: boolean;
}): Promise<{
  chatModels: StoryboardGatewayModel[];
  visionModels: StoryboardGatewayModel[];
  imageModels: StoryboardGatewayModel[];
  imageGenConcurrencyLimit: number;
}> {
  if (!opts?.force) {
    const cached = readCache<{
      chatModels: StoryboardGatewayModel[];
      visionModels: StoryboardGatewayModel[];
      imageModels: StoryboardGatewayModel[];
      imageGenConcurrencyLimit: number;
    }>(MODELS_CACHE_KEY, MODELS_CACHE_MS, localStorage);
    if (cached && !isEmptyModelsPayload(cached)) return cached;
  }

  const data = await ecomBookFetch(`${BASE}/models`);
  const result = {
    chatModels: (data.chatModels as StoryboardGatewayModel[]) ?? [],
    visionModels: (data.visionModels as StoryboardGatewayModel[]) ?? [],
    imageModels: (data.imageModels as StoryboardGatewayModel[]) ?? [],
    imageGenConcurrencyLimit:
      typeof data.imageGenConcurrencyLimit === "number"
        ? data.imageGenConcurrencyLimit
        : 2,
  };
  if (!isEmptyModelsPayload(result)) {
    writeCache(MODELS_CACHE_KEY, result, localStorage);
  }
  return result;
}

/**
 * detailed 会额外读取 brief / references / design 三个 JSON 列，仅项目选择器需要；
 * 只为拿最近项目 id 时保持默认的轻量查询。
 */
export async function listProductDesignProjects(
  module: EcomProjectModule = "main-image",
  opts?: { detailed?: boolean },
): Promise<ProductDesignProjectSummary[]> {
  const qs = new URLSearchParams({ module });
  if (opts?.detailed) qs.set("detailed", "1");
  const data = await ecomBookFetch(`${BASE}/projects?${qs.toString()}`);
  return (data.items as ProductDesignProjectSummary[]) ?? [];
}

export async function createProductDesignProject(opts?: {
  title?: string;
  platform?: string;
  brief?: ProductDesignBrief;
  module?: EcomProjectModule;
  /** 从已有主图项目导入 Step0–3 策略与产品图 */
  importFrom?: ProductDesignStrategyImport;
}): Promise<ProductDesignProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as ProductDesignProject;
}

export async function getProductDesignProject(id: string): Promise<ProductDesignProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as ProductDesignProject;
}

export async function updateProductDesignProject(
  id: string,
  patch: Partial<{
    title: string;
    platform: string;
    status: string;
    brief: ProductDesignBrief;
    settings: ProductDesignSettings;
    references: ProductDesignReference[];
    chatHistory: ProductDesignChatMessage[];
    design: ProductDesign | null;
    designPatch: ProductDesignDesignPatch;
    meta: Record<string, unknown>;
  }>,
): Promise<ProductDesignProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as ProductDesignProject;
}

export async function deleteProductDesignProject(id: string): Promise<void> {
  await ecomBookFetch(`${BASE}/projects/${id}`, { method: "DELETE" });
}

export async function resetProductDesignProject(id: string): Promise<ProductDesignProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}/reset`, {
    method: "POST",
  });
  return data.project as ProductDesignProject;
}

export async function uploadProductDesignRef(
  projectId: string,
  file: File,
  opts: { label: string; role: ProductDesignReference["role"] },
): Promise<ProductDesignReference> {
  const form = new FormData();
  form.append("file", file);
  form.append("label", opts.label);
  form.append("role", opts.role);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/upload`, {
    method: "POST",
    body: form,
  });
  return data.reference as ProductDesignReference;
}

export async function removeProductDesignRef(
  projectId: string,
  refId: string,
): Promise<void> {
  await ecomBookFetch(
    `${BASE}/projects/${projectId}/upload?refId=${encodeURIComponent(refId)}`,
    { method: "DELETE" },
  );
}

export async function syncProductDesign(
  projectId: string,
  raw?: string,
): Promise<ProductDesignProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/design/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(raw ? { raw } : {}),
  });
  return data.project as ProductDesignProject;
}

export async function analyzeProductDesignReferences(
  projectId: string,
  opts: {
    target: "main" | "detail";
    modelKey?: string;
    analysisMode?: "copy" | "reference-style";
  },
): Promise<{
  entry: ProductDesignVisualBriefEntry;
  project: ProductDesignProject;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/references/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return {
    entry: data.entry as ProductDesignVisualBriefEntry,
    project: data.project as ProductDesignProject,
  };
}

export async function generateProductDesignImages(
  projectId: string,
  opts: {
    target: "main" | "detail";
    indexes?: number[];
    modelKey?: string;
    ratio?: EcomImageRatio;
    concurrency?: number;
  },
): Promise<{
  project: ProductDesignProject;
  generated: number;
  failures: Array<{ index: number; message: string }>;
}> {
  let res: Response;
  try {
    res = await fetch(
      `/api/book-mall/${BASE}/projects/${projectId}/image/generate`,
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
        ? "与服务器连接中断（批量出图约需数分钟）。请刷新页面查看已生成部分，或改为逐张重试。"
        : msg,
    );
  }
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* 非 JSON 响应 */
  }
  if (!res.ok) {
    const code = typeof data.error === "string" ? data.error : "";
    const detail = typeof data.detail === "string" ? data.detail : "";
    if (code === "upstream_fetch_failed") {
      throw new Error(
        "与主站连接中断（出图可能仍在后台进行）。请稍候刷新页面查看已生成部分，未完成张数可逐张重试。",
      );
    }
    throw new Error(
      code && code !== "error"
        ? detail
          ? `${code}：${detail}`
          : code
        : typeof data.error === "string"
          ? data.error
          : `请求失败 (${res.status})`,
    );
  }
  return {
    project: data.project as ProductDesignProject,
    generated: typeof data.generated === "number" ? data.generated : 0,
    failures: Array.isArray(data.failures)
      ? (data.failures as Array<{ index: number; message: string }>)
      : [],
  };
}

export async function suggestProductDesignBrief(
  projectId: string,
  opts?: { modelKey?: string },
): Promise<{
  suggestions: import("@/lib/product-design-workflow").BriefSuggestions;
  project: ProductDesignProject;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/brief/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return {
    suggestions: data.suggestions as import("@/lib/product-design-workflow").BriefSuggestions,
    project: data.project as ProductDesignProject,
  };
}

export async function streamProductDesignChat(opts: {
  projectId: string;
  messages: ProductDesignChatMessage[];
  modelKey: string;
  onChunk: (text: string) => void;
}): Promise<string> {
  const res = await fetch(
    `/api/book-mall/${BASE}/projects/${opts.projectId}/assistant/chat`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: opts.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
        modelKey: opts.modelKey,
      }),
    },
  );
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    const text = await res.text();
    let err = `请求失败 (${res.status})`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) err = j.error;
    } catch {
      /* keep default */
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
    full += decoder.decode(value, { stream: true });
    opts.onChunk(full);
  }
  return full;
}

/** 把已生成的产品图推到微剧故事版，返回新建的故事版项目 id */
export async function createStoryboardFromAssets(opts: {
  assetIds: string[];
  title?: string;
  role?: "product" | "scene";
}): Promise<{ projectId: string }> {
  const data = await ecomBookFetch(
    "api/sso/tools/ecom/storyboard/projects/from-assets",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    },
  );
  return { projectId: (data.project as { id: string }).id };
}

export async function decomposeProductDesignImagePlan(
  projectId: string,
  opts: {
    target: "main" | "detail";
    modelKey?: string;
    intentPrompt?: string;
    source?: "reference-decompose" | "reference-intent";
  },
): Promise<{ plan: ImageGenPlan; project: ProductDesignProject }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/image/plan/decompose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return {
    plan: data.plan as ImageGenPlan,
    project: data.project as ProductDesignProject,
  };
}

export async function deriveProductDesignImagePlan(
  projectId: string,
  opts: { target: "main" | "detail" },
): Promise<{ plan: ImageGenPlan; project: ProductDesignProject }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/image/plan/derive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return {
    plan: data.plan as ImageGenPlan,
    project: data.project as ProductDesignProject,
  };
}

export async function patchProductDesignImagePlan(
  projectId: string,
  opts: {
    target: "main" | "detail";
    productContext?: ProductContext;
    sharedVisualBrief?: string;
    items?: ImageGenPlanItem[];
  },
): Promise<{ plan: ImageGenPlan; project: ProductDesignProject }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/image/plan`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return {
    plan: data.plan as ImageGenPlan,
    project: data.project as ProductDesignProject,
  };
}

export async function confirmProductDesignImagePlan(
  projectId: string,
  opts: { target: "main" | "detail" },
): Promise<{ plan: ImageGenPlan; project: ProductDesignProject }> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/image/plan/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return {
    plan: data.plan as ImageGenPlan,
    project: data.project as ProductDesignProject,
  };
}

/** 下载分类 ZIP 交付包（文案 + 主图 + 详情 + 参考图） */
async function downloadProductDesignZip(
  projectId: string,
  opts?: { mode?: "export" | "save"; productName?: string },
): Promise<void> {
  const qs = new URLSearchParams();
  if (opts?.mode === "save") qs.set("mode", "save");
  if (opts?.productName?.trim()) qs.set("productName", opts.productName.trim());
  const query = qs.toString();
  let res: Response;
  try {
    res = await fetch(
      `/api/book-mall/${BASE}/projects/${projectId}/export${query ? `?${query}` : ""}`,
      { method: "GET", credentials: "include" },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg === "fetch failed" ? "与服务器连接中断，请稍后重试。" : msg);
  }
  if (res.status === 401) throw new EcomUnauthorizedError("未登录");
  if (!res.ok) {
    let message = opts?.mode === "save" ? "保存失败" : `导出失败 (${res.status})`;
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
      : opts?.mode === "save"
        ? "product-save.zip"
        : "product-design-export.zip";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadProductDesignExportZip(projectId: string): Promise<void> {
  await downloadProductDesignZip(projectId, { mode: "export" });
}

export type ProductDesignWorkflowSnapshot = {
  savedAt: string;
  title: string;
  productName?: string;
  module: string;
  platform: string;
};

/** 保存完整工作流镜像到资产库（电商主图 / 详情页类目） */
export async function saveProductDesignWorkflow(
  projectId: string,
  productName: string,
): Promise<ProductDesignWorkflowSnapshot> {
  const trimmed = productName.trim();
  if (!trimmed) throw new Error("请填写产品名");
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productName: trimmed }),
  });
  return data.snapshot as ProductDesignWorkflowSnapshot;
}

/** 从资产库快照一键复用（复制流程，去掉成图） */
export async function reuseProductDesignProject(
  projectId: string,
  savedAt: string,
): Promise<ProductDesignProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/reuse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ savedAt }),
  });
  return data.project as ProductDesignProject;
}

/** @deprecated 请使用 saveProductDesignWorkflow 保存到资产库 */
export async function saveProductDesignProjectZip(
  projectId: string,
  productName: string,
): Promise<void> {
  await saveProductDesignWorkflow(projectId, productName);
}
