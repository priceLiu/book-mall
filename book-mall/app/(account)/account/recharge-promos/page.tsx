import { redirect } from "next/navigation";

/** 旧钱包充值优惠已下线，统一改轻量包购买。 */
export default function RechargePromosPage() {
  redirect("/account/billing");
}
