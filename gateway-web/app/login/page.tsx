import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-[var(--gw-muted)]">加载中…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
