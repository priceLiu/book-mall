import { redirect } from "next/navigation";

/** 预览已并入正式首页，保留路由跳转 */
export default function HomePreviewRedirect() {
  redirect("/");
}
