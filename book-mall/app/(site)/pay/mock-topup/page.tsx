import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  normalizeMockTopupAmountMinor,
  type MockTopupAmountMinor,
} from "@/lib/apply-mock-topup";
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
  const initialAmountMinor: MockTopupAmountMinor = normalizeMockTopupAmountMinor(
    searchParams.amount,
  );

  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/pay/mock-topup?amount=${initialAmountMinor}`)}`,
    );
  }

  return <MockTopupCheckout initialAmountMinor={initialAmountMinor} />;
}
