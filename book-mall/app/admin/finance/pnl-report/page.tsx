import { redirectToFinanceWeb } from "@/lib/finance-web-redirect";

export default function PnlReportRedirectPage() {
  redirectToFinanceWeb("/admin/pnl-report");
}
