import { redirect } from "next/navigation";
import { bookAccountHomeUrl } from "@/lib/book-only-entry";

/** finance-web 无独立门户：根路径回主站个人中心。 */
export default function HomePage() {
  const accountUrl = bookAccountHomeUrl();
  if (accountUrl) redirect(accountUrl);
  redirect("/fees/usage?from=account");
}
