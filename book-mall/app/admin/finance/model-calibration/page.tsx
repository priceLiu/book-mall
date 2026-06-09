import { redirectToFinanceWeb } from "@/lib/finance-web-redirect";

export default function ModelCalibrationRedirectPage() {
  redirectToFinanceWeb("/admin/model-cost");
}
