import { redirect } from "next/navigation";
import { bookAdminHomeUrl } from "@/lib/book-only-entry";

/** 无独立 admin 门户 hub：回主站管理后台。 */
export default function AdminHomePage() {
  const adminUrl = bookAdminHomeUrl();
  if (adminUrl) redirect(adminUrl);
  redirect("/admin/credit-expiry-ops");
}
