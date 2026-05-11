import { redirect } from "next/navigation";

/** 已合并至「订阅与计费」 */
export default function AdminPlatformRedirect() {
  redirect("/admin/billing");
}
