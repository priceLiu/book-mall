"use client";

import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface MathCaptchaProps {
  onVerify: (token: string, answer: number) => boolean;
  disabled?: boolean;
  className?: string;
}

export function MathCaptcha({ onVerify, disabled, className }: MathCaptchaProps) {
  const [question, setQuestion] = useState("");
  const [token, setToken] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchCaptcha = useCallback(async () => {
    setLoading(true);
    setError("");
    setAnswer("");
    try {
      const res = await fetch("/api/auth/captcha/generate");
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

  function handleVerify() {
    const num = parseInt(answer, 10);
    if (isNaN(num)) {
      setError("请输入数字答案");
      return;
    }
    const ok = onVerify(token, num);
    if (!ok) {
      setError("答案错误，请重试");
      fetchCaptcha();
    } else {
      setError("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleVerify();
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
        onChange={(e) => {
          setAnswer(e.target.value.replace(/\D/g, ""));
          setError("");
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled || loading}
        className="w-16 h-8 text-center text-sm"
      />
      <Button
        type="button"
        variant="default"
        size="sm"
        className="h-8 shrink-0"
        onClick={handleVerify}
        disabled={disabled || loading || !answer.trim()}
      >
        确认
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={fetchCaptcha}
        disabled={disabled || loading}
        title="换一题"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
