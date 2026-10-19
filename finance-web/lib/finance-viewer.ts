import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import {
  BOOK_MALL_VIEWER_FETCH_MS,
  fetchWithOptionalTimeout,
} from "@/lib/book-mall-fetch-timeout";
import type { FinancePermissions } from "./permissions";

export type FinanceViewerUser = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: string;
};

export type FinanceTeamMembership = {
  tenantId: string;
  tenantName: string;
  role: string;
  canViewBilling: boolean;
};

export type FinanceViewerPayload = {
  user: FinanceViewerUser;
  permissions: FinancePermissions;
  teams: FinanceTeamMembership[];
  hasTeam: boolean;
};

export type FinanceViewerFetchResult =
  | { status: "ok"; viewer: FinanceViewerPayload }
  | { status: "guest" }
  | { status: "unreachable"; reason: "timeout" | "network" | "upstream" };

export async function fetchFinanceViewerDetailed(
  base: string,
  signal?: AbortSignal,
): Promise<FinanceViewerFetchResult> {
  if (!base) return { status: "guest" };
  try {
    const { url, init } = resolveBookMallBrowserRequest(base, "/api/finance/viewer-session", {
      signal,
    });
    const res = await fetchWithOptionalTimeout(url, init, BOOK_MALL_VIEWER_FETCH_MS);
    if (res.status === 503 || res.status === 502) return { status: "unreachable", reason: "upstream" };
    if (!res.ok) return { status: "guest" };
    const j = (await res.json()) as { user: FinanceViewerUser | null } & Partial<FinanceViewerPayload>;
    if (!j.user) return { status: "guest" };
    return {
      status: "ok",
      viewer: {
        user: j.user,
        permissions: j.permissions ?? {
          isPlatformStaff: false,
          canViewFinanceCost: false,
          canManagePricing: false,
          canCreateProposal: false,
          canFinanceReview: false,
          canFinalApprove: false,
        },
        teams: j.teams ?? [],
        hasTeam: j.hasTeam ?? false,
      },
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { status: "unreachable", reason: "timeout" };
    }
    return { status: "unreachable", reason: "network" };
  }
}

export async function fetchFinanceViewer(
  base: string,
  signal?: AbortSignal,
): Promise<FinanceViewerPayload | null> {
  const r = await fetchFinanceViewerDetailed(base, signal);
  if (r.status === "ok") return r.viewer;
  return null;
}

/** 经 finance-web BFF 代理调用 book-mall API（生产跨域）。 */
export async function financeApiFetch<T>(
  base: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const { url, init: baseInit } = resolveBookMallBrowserRequest(base, path, init);
  const res = await fetch(url, { ...baseInit, ...init, headers: { ...baseInit.headers, ...init?.headers } });
  if (!res.ok) {
    let error = `${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) error = j.error;
    } catch {
      /* ignore */
    }
    return { ok: false, error, status: res.status };
  }
  return { ok: true, data: (await res.json()) as T };
}

/** POST JSON 到 book-mall 财务 API。 */
export async function financeApiPost<T>(
  base: string,
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  return financeApiFetch<T>(base, path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
