import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { MarginProjectionView } from "@/components/admin/margin-projection-view";
import { authOptions } from "@/lib/auth";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import { loadMarginProjection } from "@/lib/billing/load-margin-projection";
import { buildMarginProjection } from "@/lib/billing/margin-projection";

export const dynamic = "force-dynamic";

export default async function MarginProjectionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!canViewFinanceCost(session.user.role)) redirect("/account");

  const data = await loadMarginProjection().catch((err) => {
    console.error("[margin-projection] load failed, using seed", err);
    return buildMarginProjection({});
  });

  return <MarginProjectionView data={data} />;
}
