import { Suspense } from "react";
import { TeamDashboardClient } from "@/components/team-dashboard-client";
import { FinancePageState } from "@/components/finance-page-shell";

export const dynamic = "force-dynamic";

export default function TeamDashboardPage() {
  return (
    <Suspense fallback={<FinancePageState>加载中…</FinancePageState>}>
      <TeamDashboardClient />
    </Suspense>
  );
}
