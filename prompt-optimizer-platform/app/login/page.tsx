import { redirect } from "next/navigation";
import { promptOptimizerLoginHref } from "@/lib/portal-auth-links";

export const dynamic = "force-dynamic";

function safeRedirect(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/";
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  redirect(promptOptimizerLoginHref(safeRedirect(searchParams?.redirect)));
}
