"use client";

import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight, User } from "lucide-react";
import { AuthGlassInput, AuthGlassScreen } from "@/components/auth/auth-glass-screen";

export function RegisterForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<"name" | "email" | "password" | null>(null);

  const showGoogle = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data as {
          error?: unknown;
          detail?: string;
        };
        let msg: string;
        if (typeof err.error === "string") {
          msg = err.error;
        } else if (err.error && typeof err.error === "object") {
          msg = JSON.stringify(err.error);
        } else {
          msg = "注册失败，请检查表单";
        }
        if (typeof err.detail === "string" && err.detail.length > 0) {
          msg = `${msg}：${err.detail}`;
        }
        setError(msg);
        return;
      }
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGlassScreen>
      <div className="mb-5 space-y-1 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.8 }}
          className="relative mx-auto flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10"
        >
          <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-lg font-bold text-transparent">
            智
          </span>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-b from-white to-white/80 bg-clip-text text-xl font-bold text-transparent"
        >
          创建账号
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-xs text-white/60"
        >
          加入智选 AI Mall，开启订阅与工具权益
        </motion.p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-3">
          <motion.div
            className={focusedInput === "name" ? "relative z-10" : "relative"}
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div className="relative flex items-center overflow-hidden rounded-lg">
              <User
                className={`absolute left-3 h-4 w-4 transition-all duration-300 ${
                  focusedInput === "name" ? "text-white" : "text-white/40"
                }`}
                aria-hidden
              />
              <AuthGlassInput
                type="text"
                name="name"
                autoComplete="nickname"
                placeholder="昵称（可选）"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocusedInput("name")}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
          </motion.div>

          <motion.div
            className={focusedInput === "email" ? "relative z-10" : "relative"}
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div className="relative flex items-center overflow-hidden rounded-lg">
              <Mail
                className={`absolute left-3 h-4 w-4 transition-all duration-300 ${
                  focusedInput === "email" ? "text-white" : "text-white/40"
                }`}
                aria-hidden
              />
              <AuthGlassInput
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedInput("email")}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
          </motion.div>

          <motion.div
            className={focusedInput === "password" ? "relative z-10" : "relative"}
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div className="relative flex items-center overflow-hidden rounded-lg">
              <Lock
                className={`absolute left-3 h-4 w-4 transition-all duration-300 ${
                  focusedInput === "password" ? "text-white" : "text-white/40"
                }`}
                aria-hidden
              />
              <AuthGlassInput
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="密码（至少 8 位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedInput("password")}
                onBlur={() => setFocusedInput(null)}
                className="pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 cursor-pointer rounded p-0.5 text-white/40 transition-colors hover:text-white"
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
              >
                {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </motion.div>
        </div>

        {error ? (
          <p className="text-center text-xs text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading}
          className="group/button relative mt-2 w-full"
        >
          <div className="absolute inset-0 rounded-lg bg-white/10 opacity-0 blur-lg transition-opacity duration-300 group-hover/button:opacity-70" />
          <div className="relative flex h-10 items-center justify-center overflow-hidden rounded-lg bg-white font-medium text-black transition-all duration-300">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center"
                >
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/70 border-t-transparent" />
                </motion.div>
              ) : (
                <motion.span
                  key="btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1 text-sm font-medium"
                >
                  创建账号
                  <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover/button:translate-x-1" />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.button>

        {showGoogle ? (
          <>
            <div className="relative mt-2 mb-5 flex items-center">
              <div className="grow border-t border-white/5" />
              <span className="mx-3 text-xs text-white/40">或</span>
              <div className="grow border-t border-white/5" />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              className="group/google relative w-full"
              onClick={() => void signIn("google", { callbackUrl: "/account" })}
            >
              <div className="absolute inset-0 rounded-lg bg-white/5 opacity-0 blur transition-opacity duration-300 group-hover/google:opacity-70" />
              <div className="relative flex h-10 items-center justify-center gap-2 overflow-hidden rounded-lg border border-white/10 bg-white/5 font-medium text-white transition-all duration-300 hover:border-white/20">
                <span className="text-sm text-white/80 group-hover/google:text-white">G</span>
                <span className="text-xs text-white/80 group-hover/google:text-white">
                  使用 Google 注册
                </span>
              </div>
            </motion.button>
          </>
        ) : null}

        <motion.p
          className="mt-4 text-center text-xs text-white/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          已有账号？{" "}
          <Link href="/login" className="font-medium text-white hover:text-white/80">
            登录
          </Link>
        </motion.p>
      </form>
    </AuthGlassScreen>
  );
}
