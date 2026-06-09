import { redirect } from "next/navigation";

/** 旧模拟订阅收银已退役，重定向至 Finance 2.0 定价页。 */
export default function MockSubscribePayPage() {
  redirect("/pricing");
}
