import { redirect } from "next/navigation";
import { getBookAccountUrl } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

/** 子门户不承载个人中心，统一跳转主站 Book /account */
export default function AccountRedirectPage() {
  redirect(getBookAccountUrl() ?? "/");
}
