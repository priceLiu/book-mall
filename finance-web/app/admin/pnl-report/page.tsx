import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { PnlReportClient } from "@/components/admin/pnl-report-client";

export default function PnlReportPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <PnlReportClient />
    </FinanceAdminGate>
  );
}
