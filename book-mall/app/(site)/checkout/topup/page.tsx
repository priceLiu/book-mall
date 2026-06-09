import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { packById } from "@/lib/billing/credit-topup-packs";
import { TopupCheckoutClient } from "@/components/checkout/topup-checkout-client";

export const dynamic = "force-dynamic";

export default async function CheckoutTopupPage({
  searchParams,
}: {
  searchParams?: { packId?: string; target?: string; tenantId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/checkout/topup?packId=${searchParams?.packId ?? ""}`);
  }

  const packId = searchParams?.packId?.trim();
  if (!packId) redirect("/pricing");

  const pack = packById(packId);
  if (!pack) redirect("/pricing");

  const target = searchParams?.target === "team" ? "team" : "personal";
  const tenantId = searchParams?.tenantId?.trim() || undefined;

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <TopupCheckoutClient
        packId={pack.id}
        packLabel={pack.label}
        credits={pack.credits}
        priceYuan={pack.priceYuan}
        target={target}
        tenantId={tenantId}
      />
    </main>
  );
}
