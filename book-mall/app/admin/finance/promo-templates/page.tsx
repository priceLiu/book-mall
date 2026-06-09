import { redirectToFinanceWeb } from "@/lib/finance-web-redirect";

export default function PromoTemplatesRedirectPage() {
  redirectToFinanceWeb("/admin/membership-plans");
}
