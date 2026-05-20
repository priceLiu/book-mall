import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = {
  title: "注册 — AI Mall",
};

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
