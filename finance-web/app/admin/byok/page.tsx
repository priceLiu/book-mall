import { redirect } from "next/navigation";

/** 积分换算 1.0：BYOK 技术服务费定价页已退役，见积分换算工作台。 */
export default function AdminByokPage() {
  redirect("/admin/credit-pricing");
}
