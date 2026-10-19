import { redirect } from "next/navigation";

/** 趋势与 KPI 已合并进 /admin 长页 */
export default function AdminCockpitAnalyticsRedirectPage() {
  redirect("/admin#metrics");
}
