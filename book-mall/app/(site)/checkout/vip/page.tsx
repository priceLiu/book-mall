import { redirect } from "next/navigation";

/** VIP 大额预充不对客开放，统一走财务后台运营台。 */
export default function CheckoutVipPage() {
  redirect("/pricing");
}
