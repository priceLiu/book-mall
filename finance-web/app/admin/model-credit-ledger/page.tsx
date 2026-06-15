import { redirect } from "next/navigation";

/** 积分换算 1.0：已合并至积分报价与换算 */
export default function ModelCreditLedgerPage() {
  redirect("/admin/credit-pricing");
}
