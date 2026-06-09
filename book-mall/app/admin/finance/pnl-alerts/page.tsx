import { redirect } from "next/navigation";
import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";

/** 盈亏预警已迁入 finance-web；本页仅作重定向兜底。 */
export default function PnlAlertsRedirectPage() {
  const origin = getFinanceWebPublicOrigin();
  if (origin) redirect(`${origin}/admin/pnl-alerts`);
  redirect("/admin");
}
