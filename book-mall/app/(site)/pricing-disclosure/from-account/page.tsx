import { redirect } from "next/navigation";

import { PRICING_DISCLOSURE_FROM_ACCOUNT_ALIAS } from "@/lib/pricing-disclosure-view";

/** 旧个人中心入口：统一到公示页 */
export default function PricingDisclosureFromAccountPage() {
  redirect(PRICING_DISCLOSURE_FROM_ACCOUNT_ALIAS);
}
