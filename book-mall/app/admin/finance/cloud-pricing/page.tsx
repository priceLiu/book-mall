import { redirectToFinanceWeb } from "@/lib/finance-web-redirect";

export default function CloudPricingRedirectPage() {
  redirectToFinanceWeb("/admin/reconciliation");
}
