import { redirect } from "next/navigation";

/** 模型系数（Scheme A）已退役，重定向至积分报价。 */
export default function ModelCoefficientsRedirectPage() {
  redirect("/admin/credit-pricing");
}
