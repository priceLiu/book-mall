import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

export type Sbv1PortraitLivenessSessionDto = {
  bytedToken: string;
  h5Link: string;
  callbackUrl: string;
  expiresInSec: number;
};

export type Sbv1PortraitLivenessResultDto = {
  status: "pending" | "succeeded" | "failed";
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
    let msg = raw;
    try {
      const j = JSON.parse(raw) as { error?: string; message?: string };
      msg = j.message ?? j.error ?? raw;
    } catch {
      /* keep raw */
    }
    throw new Error(msg || r.statusText);
  }
  return raw ? (JSON.parse(raw) as T) : (undefined as unknown as T);
}

export async function createSbv1PortraitLivenessSession(
  base: string,
): Promise<Sbv1PortraitLivenessSessionDto> {
  return call(base, "/api/canvas/sbv1/portrait/liveness/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export async function pollSbv1PortraitLivenessResult(
  base: string,
  bytedToken: string,
): Promise<Sbv1PortraitLivenessResultDto> {
  return call(base, "/api/canvas/sbv1/portrait/liveness/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bytedToken }),
  });
}
