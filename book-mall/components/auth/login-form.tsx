"use client";

import { type FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { AuthHomeV2FormHeader } from "@/components/auth/auth-home-v2-form-header";
import { AuthHomeV2Screen } from "@/components/auth/auth-home-v2-screen";
import {
  AuthHomeV2Fields,
  AuthHomeV2SubmitButton,
} from "@/components/auth/auth-home-v2-fields";
import { SmsCodeField } from "@/components/auth/sms-code-field";
import { LoginLegacyGuide } from "@/components/auth/login-legacy-guide";
import { navigateAfterAuth } from "@/lib/post-auth-navigate";

function safeNextPath(raw: string | null): string {
  if (!raw) return "/account";
  const u = raw.trim();
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  try {
    const parsed = new URL(u);
    if (parsed.pathname.startsWith("/")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    /* ignore */
  }
  return "/account";
}

function redirectProductionHttpToHttps(): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") return;
  const { protocol, hostname, href } = window.location;
  if (protocol !== "http:") return;
  const h = hostname.toLowerCase();
  if (h !== "ai-code8.com" && !h.endsWith(".ai-code8.com")) return;
  window.location.replace(href.replace(/^http:/i, "https:"));
}

type LoginTab = "password" | "otp";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("callbackUrl"));

  const [tab, setTab] = useState<LoginTab>("password");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    redirectProductionHttpToHttps();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // 先检查手机号状态，给出明确提示
      const check = await fetch("/api/auth/check-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const checkData = await check.json().catch(() => ({}));
      if (!check.ok || checkData.error) {
        setError(checkData.error ?? "检查失败，请重试");
        return;
      }

      // 未注册
      if (!checkData.exists) {
        setError(checkData.hint ?? "该手机号未注册");
        return;
      }

      // 未验证
      if (!checkData.verified) {
        setError(checkData.hint ?? "该手机号尚未验证");
        return;
      }

      // 密码登录但没有密码 → 引导用验证码
      if (tab === "password" && !checkData.hasPassword) {
        setError(checkData.hint ?? "该账号未设置密码，请使用验证码登录");
        return;
      }

      const res = await signIn("credentials", {
        phone,
        loginMode: tab,
        password: tab === "password" ? password : undefined,
        code: tab === "otp" ? code : undefined,
        redirect: false,
      });
      if (res?.error) {
        setError(tab === "password" ? "密码错误，请重试" : "验证码错误，请重试");
        return;
      }
      if (!res?.ok) {
        setError("登录请求失败，请清除本站 Cookie 后重试或稍后再试");
        return;
      }
      navigateAfterAuth(next);
      return;
    } catch {
      setError("无法连接登录服务，请刷新页面后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthHomeV2Screen>
      <AuthHomeV2FormHeader
        title="欢迎回来"
        lead={
          <>
            还没有账号？ <Link href="/register">注册</Link>
          </>
        }
      />

      <div className="auth-v2-tabs" role="tablist">
        {(
          [
            ["password", "密码登录"],
            ["otp", "验证码登录"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className="auth-v2-tab"
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="auth-v2-form">
        <AuthHomeV2Fields
            fields={[
              {
                name: "phone",
                label: "手机号",
                type: "tel",
                placeholder: "请输入 11 位手机号",
                value: phone,
                onChange: (e) => setPhone(e.target.value),
              },
              ...(tab === "password"
                ? [
                    {
                      name: "password",
                      label: "密码",
                      type: "password" as const,
                      placeholder: "请输入密码",
                      value: password,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                        setPassword(e.target.value),
                    },
                  ]
                : []),
            ]}
            passwordVisible={showPassword}
            onTogglePassword={() => setShowPassword((v) => !v)}
          />

          {tab === "otp" ? (
            <SmsCodeField
              phone={phone}
              purpose="LOGIN"
              code={code}
              onCodeChange={setCode}
              disabled={loading}
            />
          ) : null}

          {error ? (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          ) : null}

        <AuthHomeV2SubmitButton disabled={loading} loading={loading}>
          登录
        </AuthHomeV2SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        <Link href="/forgot-password" className="text-[var(--accent)] hover:underline">
          忘记密码？
        </Link>
      </p>

      <LoginLegacyGuide />
    </AuthHomeV2Screen>
  );
}
