import { redirect } from "next/navigation";

/** Phase D：单品工具订阅已退役，统一跳转工具技术服务费页。 */
export default function AccountSubscriptionToolsRedirect() {
  redirect("/account/tool-service-fee");
}
