import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** 旧个人中心入口：统一到 `/account/pricing` */
export default function PricingDisclosureFromAccountPage() {
  redirect("/account/pricing");
}
