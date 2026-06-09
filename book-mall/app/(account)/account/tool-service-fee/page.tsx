import { redirect } from "next/navigation";

/** 工具技术服务费已下线，统一改由会员套餐准入。 */
export default function AccountToolServiceFeePage() {
  redirect("/pricing");
}
