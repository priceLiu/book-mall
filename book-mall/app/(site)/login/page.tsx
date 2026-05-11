import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "登录 — AI Mall",
};

export default function LoginPage() {
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
