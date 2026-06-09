import { redirect } from "next/navigation";

/** 个人中心价目页已退役，统一到公开报价页。 */
export default function AccountPricingPage() {
  redirect("/pricing");
}
