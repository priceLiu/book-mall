import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { productionHttpsRedirectUrlFromHeaders } from "@/lib/production-origin";

export const metadata = {
  title: "登录 — AI Mall",
};

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function buildSearchString(
  searchParams?: Record<string, string | string[] | undefined>,
): string {
  if (!searchParams) return "";
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") q.set(key, value);
    else if (Array.isArray(value)) {
      for (const v of value) q.append(key, v);
    }
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const h = headers();
  const search = buildSearchString(searchParams);
  const httpsTarget = productionHttpsRedirectUrlFromHeaders(
    h,
    "/login",
    search,
  );
  if (httpsTarget) redirect(httpsTarget);

  return (
    <Suspense
      fallback={
        <p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
