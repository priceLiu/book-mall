import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  normalizeMockTopupAmountPoints,
  type MockTopupAmountPoints,
} from "@/lib/apply-mock-topup";
import { listUserUnusedRechargeCoupons } from "@/lib/recharge-coupon";
import { MockTopupCheckout } from "@/components/pay/mock-topup-checkout";

export const metadata = {
  title: "模拟收银 — 钱包充值 — AI Mall",
};

export default async function MockTopupPayPage({
  searchParams,
}: {
  searchParams: { amount?: string };
}) {
  const session = await getServerSession(authOptions);
  const initialAmountPoints: MockTopupAmountPoints = normalizeMockTopupAmountPoints(
    searchParams.amount,
  );

  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/pay/mock-topup?amount=${initialAmountPoints}`)}`,
    );
  }

  const rawCoupons = await listUserUnusedRechargeCoupons(session.user.id);
  const unusedCoupons = rawCoupons.map((c) => ({
    id: c.id,
    titleSnap: c.titleSnap,
    paidAmountPointsSnap: c.paidAmountPointsSnap,
    bonusPointsSnap: c.bonusPointsSnap,
    expiresAt: c.expiresAt.toISOString(),
  }));

  return (
    <MockTopupCheckout initialAmountPoints={initialAmountPoints} unusedCoupons={unusedCoupons} />
  );
}
