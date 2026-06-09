import { redirectToFinanceWeb } from "@/lib/finance-web-redirect";

export default function ReconciliationRedirectPage() {
  redirectToFinanceWeb("/admin/reconciliation");
}
