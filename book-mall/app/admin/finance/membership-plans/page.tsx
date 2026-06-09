import { redirectToFinanceWeb } from "@/lib/finance-web-redirect";

export default function MembershipPlansRedirectPage() {
  redirectToFinanceWeb("/admin/membership-plans");
}
