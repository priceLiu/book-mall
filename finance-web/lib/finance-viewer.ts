import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import type { FinancePermissions } from "./permissions";

export type FinanceViewerUser = {
  id: string;
  email: string | null;
  name: string | null;
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

export async function fetchFinanceViewer(
  base: string,
  signal?: AbortSignal,
): Promise<FinanceViewerPayload | null> {
  if (!base) return null;
  try {
    const { url, init } = resolveBookMallBrowserRequest(base, "/api/finance/viewer-session", { signal });
    const res = await fetch(url, init);
    if (!res.ok) return null;
    const j = (await res.json()) as { user: FinanceViewerUser | null } & Partial<FinanceViewerPayload>;
    if (!j.user) return null;
    return {
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
    };
  } catch {
    return null;
  }
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
