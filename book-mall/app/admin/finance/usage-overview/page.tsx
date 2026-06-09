import { redirectToFinanceWeb } from "@/lib/finance-web-redirect";

export default function UsageOverviewRedirectPage() {
  redirectToFinanceWeb("/admin/usage-overview");
}
