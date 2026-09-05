"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MathCaptchaProps {
  onVerify: (token: string, answer: number) => boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * 加减法图片验证码组件。
 * 用户输入答案后自动验证（300ms 防抖），验证通过后自动触发 onVerify 回调。
 * 无需点确认按钮，无需回车。
 */
export function MathCaptcha({ onVerify, disabled, className }: MathCaptchaProps) {
  const [question, setQuestion] = useState("");
  const [token, setToken] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifiedRef = useRef(false);

  const fetchCaptcha = useCallback(async () => {
    setLoading(true);
    setError("");
    setAnswer("");
    setVerifying(false);
    verifiedRef.current = false;
    try {
      const res = await fetch("/api/auth/captcha/generate", { cache: "no-store" });
      const data = await res.json();
      setQuestion(data.question);
      setToken(data.token);
    } catch {
      setError("验证码加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /**
   * 验证答案。接收当前输入值，避免闭包捕获旧 state。
   */
  function doVerify(currentValue: string) {
    const num = parseInt(currentValue, 10);
    if (isNaN(num)) {
      setError("请输入数字答案");
      return;
    }
    setVerifying(true);
    const ok = onVerify(token, num);
    if (!ok) {
      setError("答案错误，自动刷新中…");
      setVerifying(false);
      // 延迟刷新让用户看到错误提示
      setTimeout(() => fetchCaptcha(), 800);
    } else {
      setError("");
      verifiedRef.current = true;
      // 保持 verifying 状态，由父组件控制
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "");
    setAnswer(val);
    setError("");

    // 已验证通过后不再重复触发
    if (verifiedRef.current) return;

    // 清除之前的防抖
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.length > 0) {
      // 300ms 防抖后自动验证，直接传值避免闭包陷阱
      debounceRef.current = setTimeout(() => doVerify(val), 300);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // 阻止 Enter 触发表单提交
    if (e.key === "Enter") {
      e.preventDefault();
      // 如果防抖还没触发，立即验证
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (!verifiedRef.current && answer.length > 0) {
        doVerify(answer);
      }
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="whitespace-nowrap text-sm font-mono text-muted-foreground select-none">
        {loading ? "加载中…" : question}
      </span>
      <Input
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="答案"
        value={answer}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled || loading || verifying}
        className="w-16 h-8 text-center text-sm"
      />
      {verifying ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={fetchCaptcha}
        disabled={disabled || loading || verifying}
        title="换一题"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
