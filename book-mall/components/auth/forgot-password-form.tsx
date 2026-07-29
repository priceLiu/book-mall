"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmsCodeField } from "@/components/auth/sms-code-field";
import { normalizePhone, isValidCnPhone } from "@/lib/auth/phone";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<"input" | "reset" | "done">("input");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const phoneNorm = normalizePhone(phone);
  const phoneValid = phoneNorm && isValidCnPhone(phoneNorm);

  async function handleNext() {
    setError("");
    if (!phoneValid) {
      setError("请输入正确的手机号");
      return;
    }
    setStep("reset");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!code.trim()) {
      setError("请输入短信验证码");
      return;
    }
    if (newPassword.length < 6) {
      setError("新密码至少 6 位");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNorm, code: code.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "重置失败");
        return;
      }
      setStep("done");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  if (step === "done") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold">密码重置成功</h1>
        <p className="text-muted-foreground">请使用新密码登录</p>
        <Button onClick={() => router.push("/login")} className="w-full">
          去登录
        </Button>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <div className="mx-auto max-w-md px-4 py-12 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">重置密码</h1>
          <p className="text-sm text-muted-foreground mt-1">
            短信将发送至 {phoneNorm}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SmsCodeField
            phone={phoneNorm ?? phone}
            purpose="RESET_PASSWORD"
            code={code}
            onCodeChange={setCode}
          />
          <div className="space-y-2">
            <Label htmlFor="new-password">新密码</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="至少 6 位"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "提交中…" : "重置密码"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline underline-offset-2">
            返回登录
          </Link>
        </p>
      </div>
    );
  }

  // step === "input"
  return (
    <div className="mx-auto max-w-md px-4 py-12 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">找回密码</h1>
        <p className="text-sm text-muted-foreground mt-1">
          输入注册时使用的手机号
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone">手机号</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="请输入手机号"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, ""));
              setError("");
            }}
            maxLength={11}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNext();
            }}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleNext} disabled={!phoneValid} className="w-full">
          下一步
        </Button>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline underline-offset-2">
          返回登录
        </Link>
      </p>
    </div>
  );
}
