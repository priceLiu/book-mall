import { redirect } from "next/navigation";

/** 积分换算 1.0：BYOK 技术服务费已退役，统一走会员订阅 + 轻量包。 */
export default function CheckoutByokPage() {
  redirect("/pricing?tab=membership&from=byok-retired");
}
