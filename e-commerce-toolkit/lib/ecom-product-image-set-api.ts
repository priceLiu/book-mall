"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  ProductImageSetProject,
  ProductImageSetSummary,
} from "@/lib/product-image-set-types";

const BASE = "api/sso/tools/ecom/product-image-set";

export async function listProductImageSetSummaries(): Promise<ProductImageSetSummary[]> {
  const data = await ecomBookFetch(`${BASE}/projects?summary=1`);
  return (data.items as ProductImageSetSummary[]) ?? [];
}

export async function createProductImageSetProject(opts?: {
  title?: string;
}): Promise<ProductImageSetProject> {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as ProductImageSetProject;
}

export async function getProductImageSetProject(id: string): Promise<ProductImageSetProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`);
  return data.project as ProductImageSetProject;
}

export async function updateProductImageSetProject(
  id: string,
  patch: {
    title?: string;
    settings?: Partial<ProductImageSetProject["settings"]>;
    meta?: Partial<ProductImageSetProject["meta"]>;
    output?: ProductImageSetProject["output"];
  },
): Promise<ProductImageSetProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return data.project as ProductImageSetProject;
}

export async function uploadProductImageSetRef(
  projectId: string,
  file: File,
  opts?: { role?: "product" | "layout-ref"; label?: string },
): Promise<ProductImageSetProject> {
  const form = new FormData();
  form.set("file", file);
  form.set("role", opts?.role ?? "product");
  if (opts?.label) form.set("label", opts.label);
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/upload`, {
    method: "POST",
    body: form,
  });
  return data.project as ProductImageSetProject;
}

export async function removeProductImageSetRef(
  projectId: string,
  refId: string,
): Promise<ProductImageSetProject> {
  const data = await ecomBookFetch(
    `${BASE}/projects/${projectId}/upload?refId=${encodeURIComponent(refId)}`,
    { method: "DELETE" },
  );
  return data.project as ProductImageSetProject;
}

export async function suggestProductImageSetBrief(
  projectId: string,
  opts?: { modelKey?: string },
): Promise<ProductImageSetProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/suggest-brief`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as ProductImageSetProject;
}

export async function planProductImageSetProject(
  projectId: string,
  opts?: { visionModelKey?: string },
): Promise<ProductImageSetProject> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data.project as ProductImageSetProject;
}

export async function generateProductImageSetBatch(
  projectId: string,
  opts?: {
    modelKey?: string;
    imageSize?: string;
    slotIds?: string[];
    regenerate?: boolean;
  },
): Promise<{
  project: ProductImageSetProject;
  generated: number;
  failures: Array<{ slotId: string; message: string }>;
}> {
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
  return data as {
    project: ProductImageSetProject;
    generated: number;
    failures: Array<{ slotId: string; message: string }>;
  };
}

export type ProductImageSetWorkflowSnapshot = {
  savedAt: string;
  title: string;
  productName?: string;
};

export async function saveProductImageSetWorkflow(
  projectId: string,
  productName: string,
): Promise<ProductImageSetWorkflowSnapshot> {
  const trimmed = productName.trim();
  if (!trimmed) throw new Error("请填写产品名");
  const data = await ecomBookFetch(`${BASE}/projects/${projectId}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productName: trimmed }),
  });
  return data.snapshot as ProductImageSetWorkflowSnapshot;
}

export async function downloadProductImageSetExportZip(projectId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/book-mall/${BASE}/projects/${projectId}/export`, {
      method: "GET",
      credentials: "include",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg === "fetch failed" ? "与服务器连接中断，请稍后重试。" : msg);
  }
  if (res.status === 401) throw new Error("未登录");
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
      : "product-image-set-export.zip";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
