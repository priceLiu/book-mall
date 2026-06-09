import { redirect } from "next/navigation";
import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";

/** book-mall 财务页迁入 finance-web 后的重定向兜底。 */
export function redirectToFinanceWeb(adminPath: string): never {
  const origin = getFinanceWebPublicOrigin();
  if (origin) redirect(`${origin}${adminPath.startsWith("/") ? adminPath : `/${adminPath}`}`);
  redirect("/admin");
}
