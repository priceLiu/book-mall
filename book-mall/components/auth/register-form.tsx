"use client";

import { type FormEvent, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BillingPersona } from "@prisma/client";

import { AuthHomeV2FormHeader } from "@/components/auth/auth-home-v2-form-header";
import { AuthHomeV2Screen } from "@/components/auth/auth-home-v2-screen";
import {
  AuthHomeV2Fields,
  AuthHomeV2SubmitButton,
} from "@/components/auth/auth-home-v2-fields";
import { SmsCodeField } from "@/components/auth/sms-code-field";
import {
  AiLegalConsentCheckboxes,
  type AiLegalConsentChecks,
  isAiLegalConsentChecksComplete,
} from "@/components/legal/ai-legal-consent-checkboxes";
import { syncAiLegalConsentAfterAuth } from "@/lib/auth/after-auth-legal-consent";
import { navigateAfterAuth } from "@/lib/post-auth-navigate";

export function RegisterForm({
  welcomeGift,
  initialReferralCode,
}: {
  welcomeGift?: { generalCredits: number } | null;
  initialReferralCode?: string;
} = {}) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState(initialReferralCode?.trim().toUpperCase() ?? "");
  const billingPersona: BillingPersona = "PLATFORM_CREDIT";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [legalChecks, setLegalChecks] = useState<AiLegalConsentChecks>({
    userAgreement: false,
    appPermissions: false,
    privacyPolicy: false,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isAiLegalConsentChecksComplete(legalChecks)) {
      setError("请分别勾选三份法律文档后再注册");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code,
          password,
          name: name || undefined,
          billingPersona,
          ...(referralCode ? { referralCode } : {}),
          legalConsent: {
            userAgreement: true,
            appPermissions: true,
            privacyPolicy: true,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data as { error?: unknown; detail?: string; hint?: string };
        let msg: string;
        if (typeof err.error === "string") msg = err.error;
        else if (err.error && typeof err.error === "object") msg = JSON.stringify(err.error);
        else msg = "注册失败，请检查表单";
        if (typeof err.hint === "string" && err.hint.length > 0) {
          msg = `${msg}\n${err.hint}`;
        }
        if (typeof err.detail === "string" && err.detail.length > 0) {
          msg = `${msg}\n${err.detail}`;
        }
        setError(msg);
        return;
      }

      const login = await signIn("credentials", {
        phone,
        password,
        loginMode: "password",
        redirect: false,
      });
      if (login?.error) {
        router.push("/login?registered=1");
        return;
      }
      const legal = await syncAiLegalConsentAfterAuth(updateSession);
      if (!legal.ok) {
        setError(legal.error ?? "注册成功，但法律文档确认失败，请重新登录后补签");
        return;
      }
      navigateAfterAuth("/account");
      return;
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthHomeV2Screen formTheme="dark">
      <AuthHomeV2FormHeader
        title="创建账号"
        lead={
          <>
            已有账号？ <Link href="/login">登录</Link>
          </>
        }
      />

      {welcomeGift && welcomeGift.generalCredits > 0 ? (
        <div className="auth-v2-welcome-gift rounded-xl px-3 py-2 text-sm leading-snug">
          注册即送 {welcomeGift.generalCredits.toLocaleString()} 积分（30 天内有效）。
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="auth-v2-form">
        <AuthHomeV2Fields
            fields={[
              {
                name: "name",
                label: "昵称",
                type: "text",
                placeholder: "选填",
                value: name,
                onChange: (e) => setName(e.target.value),
                required: false,
              },
              {
                name: "phone",
                label: "手机号",
                type: "tel",
                placeholder: "请输入 11 位手机号",
                value: phone,
                onChange: (e) => setPhone(e.target.value),
              },
              {
                name: "password",
                label: "密码",
                type: "password",
                placeholder: "至少 8 位",
                value: password,
                onChange: (e) => setPassword(e.target.value),
              },
              {
                name: "referralCode",
                label: "邀请码（选填）",
                type: "text",
                placeholder: "8 位邀请码",
                value: referralCode,
                onChange: (e) => setReferralCode(e.target.value.toUpperCase()),
                required: false,
              },
            ]}
            passwordVisible={showPassword}
            onTogglePassword={() => setShowPassword((v) => !v)}
          />

          <SmsCodeField
            phone={phone}
            purpose="REGISTER"
            code={code}
            onCodeChange={setCode}
            disabled={loading}
          />

          <AiLegalConsentCheckboxes
            value={legalChecks}
            onChange={setLegalChecks}
            disabled={loading}
            className="auth-v2-legal-consent"
          />

          {error ? (
            <p className="text-sm text-red-500 whitespace-pre-line" role="alert">
              {error}
            </p>
          ) : null}

        <AuthHomeV2SubmitButton
          disabled={loading || !isAiLegalConsentChecksComplete(legalChecks)}
          loading={loading}
        >
          创建账号
        </AuthHomeV2SubmitButton>
      </form>
    </AuthHomeV2Screen>
  );
}
