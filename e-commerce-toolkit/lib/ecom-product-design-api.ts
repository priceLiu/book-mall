"use client";

import { EcomUnauthorizedError } from "@/lib/ecom-auth";
import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  EcomImageRatio,
  EcomPlatformSpec,
  ProductDesign,
  ProductDesignBrief,
  ProductDesignChatMessage,
  ProductDesignProject,
  ProductDesignProjectSummary,
  ProductDesignReference,
  ProductDesignSettings,
  ProductDesignVisualBriefEntry,
} from "@/lib/product-design-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const BASE = "api/sso/tools/ecom/product-design";
const SPECS_CACHE_KEY = "ecom-product-design-platform-specs";
const MODELS_CACHE_KEY = "ecom-product-design-models-cache";
const CACHE_MS = 5 * 60 * 1000;

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; data?: T };
    if (parsed.data && typeof parsed.at === "number" && Date.now() - parsed.at < CACHE_MS) {
      return parsed.data;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* ignore */
  }
}

export async function fetchPlatformSpecs(): Promise<{
  specs: EcomPlatformSpec[];
  defaultPlatform: string;
}> {
  const cached = readCache<{ specs: EcomPlatformSpec[]; defaultPlatform: string }>(
    SPECS_CACHE_KEY,
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

export async function fetchProductDesignModels(): Promise<{
  chatModels: StoryboardGatewayModel[];
  visionModels: StoryboardGatewayModel[];
  imageModels: StoryboardGatewayModel[];
}> {
  const cached = readCache<{
    chatModels: StoryboardGatewayModel[];
    visionModels: StoryboardGatewayModel[];
    imageModels: StoryboardGatewayModel[];
  }>(MODELS_CACHE_KEY);
  if (cached) return cached;

  const data = await ecomBookFetch(`${BASE}/models`);
  const result = {
    chatModels: (data.chatModels as StoryboardGatewayModel[]) ?? [],
    visionModels: (data.visionModels as StoryboardGatewayModel[]) ?? [],
    imageModels: (data.imageModels as StoryboardGatewayModel[]) ?? [],
  };
  writeCache(MODELS_CACHE_KEY, result);
  return result;
}

export async function listProductDesignProjects(): Promise<ProductDesignProjectSummary[]> {
  const data = await ecomBookFetch(`${BASE}/projects`);
  return (data.items as ProductDesignProjectSummary[]) ?? [];
}

export async function createProductDesignProject(opts?: {
  title?: string;
  platform?: string;
  brief?: ProductDesignBrief;
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
    designPatch: Partial<ProductDesign>;
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
    throw new Error(
      typeof data.error === "string" ? data.error : `请求失败 (${res.status})`,
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
