import { redirectToFinanceWeb } from "@/lib/finance-web-redirect";

export default function RechargesRedirectPage() {
  redirectToFinanceWeb("/admin/membership-plans");
}
