import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canManagePricing } from "@/lib/auth/permissions";
import {
  isAdminOnlyTopupPack,
  packById,
} from "@/lib/billing/credit-topup-packs";
import { verifyAdminTopupVerifyToken } from "@/lib/payments/admin-topup-verify-token";
import { buildLoginRedirectForCheckout } from "@/lib/payments/checkout-login-redirect";
import { checkoutSuccessRedirect } from "@/lib/payments/checkout-return-to";
import { TopupCheckoutClient } from "@/components/checkout/topup-checkout-client";

export const dynamic = "force-dynamic";

export default async function CheckoutTopupPage({
  searchParams,
}: {
  searchParams?: {
    packId?: string;
    target?: string;
    tenantId?: string;
    verifyToken?: string;
    returnTo?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const packId = searchParams?.packId?.trim();
  const verifyToken = searchParams?.verifyToken?.trim() || undefined;
  const returnTo = searchParams?.returnTo;
  const topupPath = (() => {
    const q = new URLSearchParams();
    if (packId) q.set("packId", packId);
    if (searchParams?.target === "team") q.set("target", "team");
    if (searchParams?.tenantId?.trim()) q.set("tenantId", searchParams.tenantId.trim());
    if (verifyToken) q.set("verifyToken", verifyToken);
    if (returnTo?.trim()) q.set("returnTo", returnTo.trim());
    const s = q.toString();
    return `/checkout/topup${s ? `?${s}` : ""}`;
  })();

  if (!session?.user?.id) {
    redirect(buildLoginRedirectForCheckout(topupPath));
  }

  if (!packId) redirect("/pricing");

  const pack = packById(packId);
  if (!pack) redirect("/pricing");

  if (isAdminOnlyTopupPack(pack)) {
    if (!canManagePricing(session.user.role)) {
      redirect("/pricing");
    }
    if (
      pack.requirePhoneVerify &&
      !verifyAdminTopupVerifyToken(verifyToken, session.user.id, pack.id)
    ) {
      redirect("/account/billing?error=admin_topup_verify");
    }
  }

  const target = searchParams?.target === "team" ? "team" : "personal";
  const tenantId = searchParams?.tenantId?.trim() || undefined;
  const successRedirect = checkoutSuccessRedirect(
    returnTo,
    "/account/billing?success=topup",
  );

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <TopupCheckoutClient
        packId={pack.id}
        packLabel={pack.label}
        credits={pack.credits}
        priceYuan={pack.priceYuan}
        target={target}
        tenantId={tenantId}
        verifyToken={verifyToken}
        forceRealPayment={isAdminOnlyTopupPack(pack)}
        successRedirect={successRedirect}
      />
    </main>
  );
}
