"use client";

import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

export function ReferralRegisterForm({
  code,
  referrerName,
  welcomeGift,
}: {
  code: string;
  referrerName: string | null;
  welcomeGift?: { generalCredits: number } | null;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [name, setName] = useState("");
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
    if (!name.trim()) {
      setError("请填写昵称");
      return;
    }
    if (!isAiLegalConsentChecksComplete(legalChecks)) {
      setError("请分别勾选三份法律文档后再注册");
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code: smsCode,
          name: name.trim(),
          referralCode: code,
          billingPersona: "PLATFORM_CREDIT",
        }),
          legalConsent: {
            userAgreement: true,
            appPermissions: true,
            privacyPolicy: true,
          },
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        detail?: string;
        autoLoginToken?: string;
      };
      if (!res.ok) {
        const err = data as { error?: unknown; detail?: string };
        let msg: string;
        if (typeof err.error === "string") msg = err.error;
        else if (err.error && typeof err.error === "object")
          msg = JSON.stringify(err.error);
        else msg = "注册失败，请检查表单";
        if (typeof err.detail === "string" && err.detail.length > 0) {
          msg = `${msg}：${err.detail}`;
        }
        setError(msg);
        return;
      }

      // 免密注册：用服务端返回的一次性票据建立会话。
      const login = await signIn("credentials", {
        phone,
        autoLoginToken: data.autoLoginToken,
        loginMode: "autologin",
        redirect: false,
      });
      if (login?.error) {
        router.push("/login?registered=1");
        return;
      }
      navigateAfterAuth("/account");
      const legal = await syncAiLegalConsentAfterAuth(updateSession);
      if (!legal.ok) {
        setError(legal.error ?? "注册成功，但法律文档确认失败，请重新登录后补签");
        return;
      }
      return;
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthAnimatedScreen variant="register" brandingText="智选 AI MALL">
    <AuthHomeV2Screen>
      <h1 className="auth-v2-headline">邀请注册</h1>
      <p className="auth-v2-lead">
        {referrerName
          ? `${referrerName} 邀请你加入智选 AI`
          : "你正在通过分享链接注册"}
        。已有账号？ <Link href="/login">登录</Link>
      </p>
      <p className="mb-4 text-sm text-[var(--muted)]">
        填写昵称并验证手机号即可完成，无需设置密码（后续可用短信验证码登录）。
      </p>
        {welcomeGift && welcomeGift.generalCredits > 0 ? (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
            完成注册立得 {welcomeGift.generalCredits.toLocaleString()} 积分（30 天内有效），可直接体验生图与生视频。
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4">
      <form onSubmit={onSubmit} className="auth-v2-form">
        <AuthHomeV2Fields
              {
                name: "name",
                label: "昵称",
                type: "text",
                placeholder: "请输入昵称",
                value: name,
                onChange: (e) => setName(e.target.value),
              },
              {
                name: "phone",
                label: "手机号",
                type: "tel",
                placeholder: "请输入 11 位手机号",
                value: phone,
                onChange: (e) => setPhone(e.target.value),
              },
            ]}
          />

          <SmsCodeField
            phone={phone}
            purpose="REGISTER"
            code={smsCode}
            onCodeChange={setSmsCode}
            disabled={loading}
          />

          {error ? (
          <AiLegalConsentCheckboxes
            value={legalChecks}
            onChange={setLegalChecks}
            disabled={loading}
          />

          {error ? (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          ) : null}

        <AuthHomeV2SubmitButton
          disabled={loading || !isAiLegalConsentChecksComplete(legalChecks)}
          loading={loading}
        >
          完成注册
        </AuthHomeV2SubmitButton>
      </form>
    </AuthHomeV2Screen>
}
