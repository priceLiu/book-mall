import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "找回密码 — AI Mall",
};

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
