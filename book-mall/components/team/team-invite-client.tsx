"use client";

import { type FormEvent, useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

import { AuthHomeV2Screen } from "@/components/auth/auth-home-v2-screen";
import {
  AuthHomeV2Fields,
  AuthHomeV2SubmitButton,
} from "@/components/auth/auth-home-v2-fields";
import {
  AiLegalConsentCheckboxes,
  type AiLegalConsentChecks,
  isAiLegalConsentChecksComplete,
} from "@/components/legal/ai-legal-consent-checkboxes";
import { maskPhone } from "@/lib/auth/phone";
import { navigateAfterAuth } from "@/lib/post-auth-navigate";

export function TeamInviteClient({
  token,
  tenantName,
  invitePhone,
  inviteStatus,
  inviteCode,
  userExists,
  isLoggedIn,
  hasStaleSession,
}: {
  token: string;
  tenantName: string;
  invitePhone: string;
  inviteStatus: string;
  inviteCode: string | null;
  userExists: boolean;
  isLoggedIn: boolean;
  hasStaleSession: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalChecks, setLegalChecks] = useState<AiLegalConsentChecks>({
    userAgreement: false,
    appPermissions: false,
    privacyPolicy: false,
  });

  const codeReady = Boolean(inviteCode?.trim());
  const needsLegalForNewUser = !isLoggedIn && !userExists;

  if (inviteStatus !== "PENDING") {
    return (
      <AuthHomeV2Screen>
        <h1 className="auth-v2-headline">邀请已失效</h1>
        <p className="auth-v2-lead">该邀请已过期、被撤销或已被接受。</p>
        <p className="text-center text-sm">
          <Link href="/login" className="text-[var(--accent)] hover:underline">
            前往登录
          </Link>
        </p>
      </AuthHomeV2Screen>
    );
  }

  async function acceptAfterAuth() {
    const res = await fetch("/api/team/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "接受邀请失败");
      return false;
    }
    navigateAfterAuth("/account/team");
    return true;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const code = inviteCode?.trim();
    if (!code) {
      setError("请使用短信中的完整邀请链接（含验证码）打开本页");
      return;
    }
    if (!isLoggedIn && !userExists && password.length < 8) {
      setError("请设置至少 8 位密码");
      return;
    }
    if (needsLegalForNewUser && !isAiLegalConsentChecksComplete(legalChecks)) {
      setError("请分别勾选三份法律文档后再继续");
      return;
    }

    startTransition(async () => {
      try {
        if (hasStaleSession) {
          await fetch("/api/auth/clear-session-cookies", {
            method: "POST",
            credentials: "include",
            cache: "no-store",
          }).catch(() => undefined);
        }

        if (isLoggedIn) {
          await acceptAfterAuth();
          return;
        }

        if (userExists) {
          const login = await signIn("credentials", {
            phone: invitePhone,
            code,
            loginMode: "otp",
            inviteToken: token,
            redirect: false,
          });
          if (login?.error) {
            setError("验证失败，请确认使用的是最新邀请链接");
            return;
          }
        } else {
          const reg = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: invitePhone,
              code,
              password,
              name: name || undefined,
              billingPersona: "PLATFORM_CREDIT",
              inviteToken: token,
              legalConsent: {
                userAgreement: true,
                appPermissions: true,
                privacyPolicy: true,
              },
            }),
          });
          const regData = (await reg.json().catch(() => ({}))) as {
            error?: unknown;
            detail?: string;
          };
          if (!reg.ok) {
            let msg: string;
            if (typeof regData.error === "string") msg = regData.error;
            else if (regData.error && typeof regData.error === "object") {
              msg = JSON.stringify(regData.error);
            } else msg = "注册失败，请检查表单";
            if (typeof regData.detail === "string" && regData.detail.length > 0) {
              msg = `${msg}：${regData.detail}`;
            }
            setError(msg);
            return;
          }
          const login = await signIn("credentials", {
            phone: invitePhone,
            password,
            loginMode: "password",
            redirect: false,
          });
          if (login?.error) {
            setError("注册成功但登录失败，请前往登录页");
            return;
          }
        }

        await acceptAfterAuth();
      } catch {
        setError("网络异常，请稍后重试");
      }
    });
  }

  return (
    <AuthHomeV2Screen>
      <h1 className="auth-v2-headline">
        {isLoggedIn ? "加入团队" : userExists ? "验证并加入" : "注册并加入团队"}
      </h1>
      <p className="auth-v2-lead">
        你受邀加入团队「{tenantName}」。手机号 {maskPhone(invitePhone)}
        {userExists ? "，验证后将自动加入。" : "，设置密码后即可加入。"}
      </p>

      {!codeReady ? (
        <p className="text-sm text-amber-600" role="alert">
          链接缺少验证码。请打开短信中的完整邀请链接，或联系邀请人重新发送。
        </p>
      ) : null}

      {hasStaleSession ? (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700"
          role="alert"
        >
          检测到浏览器中残留其他账号的登录态，已切换为受邀手机号流程。请完成下方注册或验证，不会使用旧账号数据。
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="auth-v2-form">
        {!isLoggedIn ? (
          <AuthHomeV2Fields
            fields={[
              ...(userExists
                ? []
                : [
                    {
                      name: "name",
                      label: "昵称",
                      type: "text" as const,
                      placeholder: "选填",
                      value: name,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                        setName(e.target.value),
                      required: false,
                    },
                  ]),
              {
                name: "phone",
                label: "手机号",
                type: "tel",
                placeholder: "请输入 11 位手机号",
                value: invitePhone,
                onChange: () => {},
                disabled: true,
              },
              ...(userExists
                ? []
                : [
                    {
                      name: "password",
                      label: "密码",
                      type: "password" as const,
                      placeholder: "至少 8 位",
                      value: password,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                        setPassword(e.target.value),
                    },
                  ]),
            ]}
            passwordVisible={showPassword}
            onTogglePassword={() => setShowPassword((v) => !v)}
          />
        ) : null}

        {needsLegalForNewUser ? (
          <AiLegalConsentCheckboxes
            value={legalChecks}
            onChange={setLegalChecks}
            disabled={pending}
            className="auth-v2-legal-consent"
          />
        ) : null}

        {error ? (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        ) : null}

        <AuthHomeV2SubmitButton
          disabled={
            !codeReady ||
            (needsLegalForNewUser && !isAiLegalConsentChecksComplete(legalChecks))
          }
          loading={pending}
        >
          {isLoggedIn ? "接受邀请" : userExists ? "验证并加入" : "注册并加入"}
        </AuthHomeV2SubmitButton>
      </form>

      {!isLoggedIn ? (
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          暂不加入？{" "}
          <Link href="/login" className="text-[var(--accent)] hover:underline">
            返回登录
          </Link>
        </p>
      ) : null}
    </AuthHomeV2Screen>
  );
}