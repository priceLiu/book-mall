import { redirectToFinanceWeb } from "@/lib/finance-web-redirect";

export default function AdminToolUsageRedirectPage() {
  redirectToFinanceWeb("/admin/usage-overview");
}
