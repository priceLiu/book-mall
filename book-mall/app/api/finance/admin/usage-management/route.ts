import { NextRequest } from "next/server";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  isDbUnavailableError,
  isPrismaConnectionUnavailable,
  logDbUnavailable,
  prismaConnectionUnavailableMessage,
} from "@/lib/db-unavailable";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import {
  buildUsageManagementCompare,
  buildUsageManagementGateway,
} from "@/lib/finance/usage-daily/build-usage-management";
import { reportVendorReconAlerts } from "@/lib/finance/usage-daily/report-vendor-recon-alerts";
import { normalizePeriod } from "@/lib/finance/reconciliation-v2/period-range";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

function parsePeriodFromSearchParams(sp: URLSearchParams) {
  const from = sp.get("from")?.trim() ?? "";
  const to = sp.get("to")?.trim() ?? "";
  if (!from || !to) {
    throw new Error("缺少 from / to 参数（YYYY-MM-DD）");
  }
  return normalizePeriod({ from, to });
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "用量对账中心仅财务管理员可见");
  }

  try {
    const period = parsePeriodFromSearchParams(request.nextUrl.searchParams);
    const data = await buildUsageManagementGateway(period);
    return financeJson(request, data);
  } catch (e) {
    if (isPrismaConnectionUnavailable(e) || isDbUnavailableError(e)) {
      logDbUnavailable("usage-management", e);
      return financeJson(
        request,
        { error: prismaConnectionUnavailableMessage(e) },
        { status: 503 },
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("缺少") || msg.includes("无效") ? 400 : 500;
    return financeJson(request, { error: msg }, { status });
  }
}

export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "用量对账中心仅财务管理员可见");
  }

  try {
    const ct = request.headers.get("content-type") ?? "";
    let from = "";
    let to = "";
    let costCsv = "";
    let amountCsv = "";

    if (ct.includes("multipart/form-data")) {
      const form = await request.formData();
      from = String(form.get("from") ?? "").trim();
      to = String(form.get("to") ?? "").trim();
      const costFile = form.get("costCsv");
      const amountFile = form.get("amountCsv");
      if (costFile instanceof File) {
        costCsv = await costFile.text();
      } else if (typeof costFile === "string") {
        costCsv = costFile;
      }
      if (amountFile instanceof File) {
        amountCsv = await amountFile.text();
      } else if (typeof amountFile === "string") {
        amountCsv = amountFile;
      }
    } else {
      const body = (await request.json()) as {
        from?: string;
        to?: string;
        costCsv?: string;
        amountCsv?: string;
      };
      from = body.from?.trim() ?? "";
      to = body.to?.trim() ?? "";
      costCsv = body.costCsv ?? "";
      amountCsv = body.amountCsv ?? "";
    }

    if (!from || !to) {
      return financeJson(request, { error: "缺少 from / to（YYYY-MM-DD）" }, { status: 400 });
    }
    if (!costCsv.trim() && !amountCsv.trim()) {
      return financeJson(
        request,
        { error: "请上传 DeepSeek cost 和/或 amount CSV" },
        { status: 400 },
      );
    }

    const period = normalizePeriod({ from, to });
    const data = await buildUsageManagementCompare({
      period,
      costCsv,
      amountCsv,
    });
    // 对账差异即时告警（fire-and-forget 落 PlatformErrorLog；/admin/errors 可见）
    reportVendorReconAlerts({ period, dailyCompare: data.dailyCompare });
    return financeJson(request, data);
  } catch (e) {
    if (isPrismaConnectionUnavailable(e) || isDbUnavailableError(e)) {
      logDbUnavailable("usage-management", e);
      return financeJson(
        request,
        { error: prismaConnectionUnavailableMessage(e) },
        { status: 503 },
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    const status =
      msg.includes("CSV") || msg.includes("无效") || msg.includes("缺少") ? 400 : 500;
    return financeJson(request, { error: msg }, { status });
  }
}
