/**
 * 画布 · 提示词模板 API（内置 + 用户自定义）
 */
import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

export type CanvasPromptEngineKind = "LLM" | "IMAGE";

export type CanvasPromptTemplateRecord = {
  id: string;
  engine: CanvasPromptEngineKind;
  name: string;
  content: string;
  description?: string;
  builtin: boolean;
  /** 已归档（软删除快照） */
  archived?: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
};

/** LLM + IMAGE 自定义模板活跃总数上限 */
export const CANVAS_USER_PROMPT_TEMPLATE_MAX = 8;

export type AppliedPromptTemplate = {
  id: string;
  name: string;
  content: string;
  builtin?: boolean;
};

async function call<T>(
  base: string,
  apiPath: string,
  init?: RequestInit,
): Promise<T> {
  const { url, init: i } = resolveBookMallBrowserRequest(base, apiPath, init);
  const r = await fetch(url, i);
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
  return JSON.parse(raw) as T;
}

export async function listCanvasPromptTemplates(
  base: string,
  engine?: CanvasPromptEngineKind,
  opts?: { includeArchived?: boolean },
): Promise<CanvasPromptTemplateRecord[]> {
  const params = new URLSearchParams();
  if (engine) params.set("engine", engine);
  if (opts?.includeArchived) params.set("includeArchived", "1");
  const q = params.toString() ? `?${params.toString()}` : "";
  const j = await call<{ templates: CanvasPromptTemplateRecord[] }>(
    base,
    `/api/canvas/prompt-templates${q}`,
  );
  return j.templates;
}

export async function getCanvasPromptTemplateUsage(
  base: string,
  id: string,
): Promise<number> {
  const j = await call<{ nodeCount: number }>(
    base,
    `/api/canvas/prompt-templates/${id}/usage`,
  );
  return j.nodeCount;
}

export async function createCanvasPromptTemplate(
  base: string,
  args: { engine: CanvasPromptEngineKind; name: string; content: string },
): Promise<CanvasPromptTemplateRecord> {
  const j = await call<{ template: CanvasPromptTemplateRecord }>(
    base,
    "/api/canvas/prompt-templates",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    },
  );
  return j.template;
}

export async function patchCanvasPromptTemplate(
  base: string,
  id: string,
  patch: { name?: string; content?: string; sortOrder?: number },
): Promise<CanvasPromptTemplateRecord> {
  const j = await call<{ template: CanvasPromptTemplateRecord }>(
    base,
    `/api/canvas/prompt-templates/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  return j.template;
}

export async function deleteCanvasPromptTemplate(
  base: string,
  id: string,
): Promise<void> {
  await call<{ ok: true }>(base, `/api/canvas/prompt-templates/${id}`, {
    method: "DELETE",
  });
}
