import { redirect } from "next/navigation";
import { hrefPricingDisclosureFromAccount } from "@/lib/pricing-disclosure-view";

export const dynamic = "force-dynamic";

/** 个人中心专用入口：整页跳转，避免软导航复用无 query 的缓存快照 */
export default function PricingDisclosureFromAccountPage() {
  redirect(hrefPricingDisclosureFromAccount());
}
