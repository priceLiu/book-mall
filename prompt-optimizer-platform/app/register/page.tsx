import { redirect } from "next/navigation";
import { promptOptimizerRegisterHref } from "@/lib/portal-auth-links";

export const dynamic = "force-dynamic";

function safeRedirect(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/";
}

export default function RegisterPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  redirect(promptOptimizerRegisterHref(safeRedirect(searchParams?.redirect)));
}
