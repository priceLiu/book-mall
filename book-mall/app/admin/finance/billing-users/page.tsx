import { redirectToFinanceWeb } from "@/lib/finance-web-redirect";

export default function BillingUsersRedirectPage() {
  redirectToFinanceWeb("/admin/billing/users");
}
