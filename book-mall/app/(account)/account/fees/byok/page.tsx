import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getFinanceFeesRedirectUrl } from "@/lib/finance-account-redirect";

export default async function AccountFeesByokRedirectPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const target = getFinanceFeesRedirectUrl("/fees/billing/byok");
  if (target) redirect(target);
  redirect("/account/byok");
}
