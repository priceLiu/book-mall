import { redirect } from "next/navigation";
import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";

/** 调价测算与审批已迁入 finance-web；本页仅作重定向兜底。 */
export default function PlanChangeRedirectPage() {
  const origin = getFinanceWebPublicOrigin();
  if (origin) redirect(`${origin}/admin/plan-change`);
  redirect("/admin");
}
