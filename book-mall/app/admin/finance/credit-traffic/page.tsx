import { redirectToFinanceWeb } from "@/lib/finance-web-redirect";

export default function CreditTrafficRedirectPage() {
  redirectToFinanceWeb("/admin/credit-traffic");
}
