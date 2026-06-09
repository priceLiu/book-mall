import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  canViewFinanceCost,
  permissionsForRole,
  type FinancePermissions,
} from "@/lib/auth/permissions";

export { permissionsForRole, type FinancePermissions };
import { financeCorsHeaders } from "@/lib/finance/cors";
import { billingPrivateCacheHeaders } from "@/lib/finance/billing-response-headers";

export type FinanceSessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
};

export async function getFinanceSession(): Promise<FinanceSessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    role: session.user.role ?? "USER",
  };
}

export function financeOptions(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...billingPrivateCacheHeaders("Cookie"),
      ...financeCorsHeaders(request),
    },
  });
}

export function financeJson<T>(
  request: NextRequest,
  body: T,
  init?: { status?: number },
): NextResponse {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: {
      ...billingPrivateCacheHeaders("Cookie"),
      ...financeCorsHeaders(request),
    },
  });
}

export function financeForbidden(request: NextRequest, message = "无权访问") {
  return financeJson(request, { error: message }, { status: 403 });
}

export function financeUnauthorized(request: NextRequest) {
  return financeJson(request, { error: "未登录" }, { status: 401 });
}
