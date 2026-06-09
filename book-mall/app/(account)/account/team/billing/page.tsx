import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";

export default async function TeamBillingRedirectPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const origin = getFinanceWebPublicOrigin();
  if (origin) redirect(`${origin}/team/billing`);
  redirect("/account/team");
}
