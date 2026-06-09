import { redirectToFinanceWeb } from "@/lib/finance-web-redirect";

export default function PricingTemplatesRedirectPage() {
  redirectToFinanceWeb("/admin/credit-pricing");
}
