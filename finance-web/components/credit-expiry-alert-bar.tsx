"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch } from "@/lib/finance-viewer";
import { canViewFinanceCost } from "@/lib/permissions";
import { fetchFinanceViewer } from "@/lib/finance-viewer";

type Alert = { code: string; level: string; message: string };

/** 财务 admin 顶栏：积分清零预警条。 */
export function CreditExpiryAlertBar() {
  const base = useBookMallBaseUrl();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!base) return;
    const ac = new AbortController();
    fetchFinanceViewer(base, ac.signal).then((v) => {
      if (v && canViewFinanceCost(v.user.role)) setAllowed(true);
    });
    return () => ac.abort();
  }, [base]);

  useEffect(() => {
    if (!base || !allowed) return;
    financeApiFetch<{ alerts: Alert[] }>(
      base,
      "/api/finance/admin/credit-expiry-ops?view=alerts",
    ).then((r) => {
      if (r.ok) setAlerts(r.data.alerts.filter((a) => a.level === "CRITICAL" || a.level === "WARN"));
    });
  }, [base, allowed]);

  if (!allowed || alerts.length === 0) return null;

  const critical = alerts.some((a) => a.level === "CRITICAL");

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-sm ${
        critical
          ? "border-[#ffccc7] bg-[#fff1f0] text-[#cf1322]"
          : "border-[#ffe58f] bg-[#fffbe6] text-[#d48806]"
      }`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          积分清零：{alerts[0]?.message}
          {alerts.length > 1 ? ` 等 ${alerts.length} 条预警` : ""}
        </span>
      </div>
      <Link href="/admin/credit-expiry-ops" className="font-medium underline hover:no-underline">
        打开运维台 →
      </Link>
    </div>
  );
}
