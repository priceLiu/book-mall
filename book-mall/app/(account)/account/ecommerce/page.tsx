import { redirect } from "next/navigation";

/** 电商工具箱设置页已退役；计费身份在注册时选定，入口见侧栏「打开电商工具箱」。 */
export default function AccountEcommercePage() {
  redirect("/account");
}
