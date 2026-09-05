import { NextRequest } from "next/server";

import { canManagePricing, canViewFinanceCost } from "@/lib/auth/permissions";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import {
  batchUpdateShelfStatus,
  listShelfForAdmin,
  upsertShelfRows,
} from "@/lib/platform-model/app-model-shelf";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "模型运营中心仅财务管理员可见");
  }

  const url = new URL(request.url);
  const appTag = url.searchParams.get("appTag")?.trim() || undefined;
  const sceneKey = url.searchParams.get("sceneKey")?.trim() ?? undefined;

  const rows = await listShelfForAdmin({ appTag, sceneKey });
  return financeJson(request, { rows });
}

export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "需要定价管理员权限");
  }

  let body: {
    rows?: Array<{
      appTag: string;
      sceneKey?: string;
      canonicalModelKey: string;
      status: "ACTIVE" | "HIDDEN" | "DEPRECATED";
      sortOrder?: number;
      displayNameOverride?: string | null;
      sourceLabelOverride?: string | null;
    }>;
    batchStatus?: {
      appTag: string;
      sceneKey?: string;
      canonicalModelKeys: string[];
      status: "ACTIVE" | "HIDDEN" | "DEPRECATED";
    };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return financeJson(request, { ok: false, error: "invalid_json" }, { status: 400 });
  }

  try {
    if (body.batchStatus) {
      const count = await batchUpdateShelfStatus(body.batchStatus);
      return financeJson(request, { ok: true, count });
    }
    if (body.rows?.length) {
      const count = await upsertShelfRows(body.rows);
      return financeJson(request, { ok: true, count });
    }
    return financeJson(request, { ok: false, error: "参数无效" }, { status: 400 });
  } catch (e) {
    return financeJson(
      request,
      { ok: false, error: e instanceof Error ? e.message : "更新失败" },
      { status: 400 },
    );
  }
}
