import { redirect } from "next/navigation";

/** 今日看板已合并进驾驶舱长页顶部 */
export default function AdminTodayRedirectPage() {
  redirect("/admin#today");
}
