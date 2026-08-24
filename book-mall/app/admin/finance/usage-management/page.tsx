import { redirectToFinanceWeb } from "@/lib/finance-web-redirect";

export default function UsageManagementRedirectPage() {
  redirectToFinanceWeb("/admin/usage-management");
}
