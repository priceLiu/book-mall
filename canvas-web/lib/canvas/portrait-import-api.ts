import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import { formatPortraitImportApiError } from "@/lib/canvas/portrait-import-api-error";
import type {
  CanvasPortraitKind,
  CanvasPortraitNodeStatus,
} from "./portrait-node-data";

export type CanvasPortraitImportResult = {
  kind: CanvasPortraitKind;
  assetId: string;
  assetUri: string;
  status: CanvasPortraitNodeStatus;
  groupId?: string;
  message?: string;
};

async function call<T>(
  base: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { url, init: reqInit } = resolveBookMallBrowserRequest(base, path, init);
  const r = await fetch(url, reqInit);
  const raw = await r.text();
  if (!r.ok) {
    throw new Error(formatPortraitImportApiError(raw, r.status, path));
  }
  return raw ? (JSON.parse(raw) as T) : (undefined as unknown as T);
}

export async function importCanvasVirtualPortrait(
  base: string,
  body: {
    imageUrl: string;
    name?: string;
    projectId?: string;
    edition?: "sbv1" | "pro2";
  },
): Promise<CanvasPortraitImportResult> {
  return call(base, "/api/canvas/portrait/virtual/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function importCanvasRealPortrait(
  base: string,
  body: {
    imageUrl: string;
    name?: string;
    projectId?: string;
    edition?: "sbv1" | "pro2";
  },
): Promise<CanvasPortraitImportResult> {
  return call(base, "/api/canvas/portrait/real/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchCanvasPortraitImportStatus(
  base: string,
  params: {
    assetId: string;
    kind?: CanvasPortraitKind;
    edition?: "sbv1" | "pro2";
    projectId?: string;
  },
): Promise<CanvasPortraitImportResult> {
  const q = new URLSearchParams({
    assetId: params.assetId,
    kind: params.kind ?? "virtual",
    edition: params.edition ?? "sbv1",
  });
  if (params.projectId) q.set("projectId", params.projectId);
  return call(base, `/api/canvas/portrait/import/status?${q.toString()}`, {
    method: "GET",
  });
}
