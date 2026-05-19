"use client";

import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { AuthGlassInput, AuthGlassScreen } from "@/components/auth/auth-glass-screen";

function safeNextPath(raw: string | null): string {
  if (!raw) return "/account";
  const u = raw.trim();
  if (!u.startsWith("/") || u.startsWith("//")) return "/account";
  return u;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("callbackUrl"));

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<"email" | "password" | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  const showGoogle = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("邮箱或密码错误");
      return;
    }
    router.push(next);
    router.refresh();
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
          欢迎回来
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-xs text-white/60"
        >
          登录以继续使用智选 AI Mall
        </motion.p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-3">
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
                aria-invalid={!!error}
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
                autoComplete="current-password"
                required
                placeholder="密码"
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

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center space-x-2">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={() => setRememberMe(!rememberMe)}
              className="h-4 w-4 appearance-none rounded border border-white/20 bg-white/5 transition-all duration-200 checked:border-white checked:bg-white focus:outline-none focus:ring-1 focus:ring-white/30"
            />
            <label htmlFor="remember-me" className="cursor-pointer text-xs text-white/60 hover:text-white/80">
              记住我
            </label>
          </div>
          <span className="text-xs text-white/40" title="请联系客服协助处理账号问题">
            忘记密码？
          </span>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading}
          className="group/button relative mt-5 w-full"
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
                  登录
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
              onClick={() => void signIn("google", { callbackUrl: next })}
            >
              <div className="absolute inset-0 rounded-lg bg-white/5 opacity-0 blur transition-opacity duration-300 group-hover/google:opacity-70" />
              <div className="relative flex h-10 items-center justify-center gap-2 overflow-hidden rounded-lg border border-white/10 bg-white/5 font-medium text-white transition-all duration-300 hover:border-white/20">
                <span className="text-sm text-white/80 group-hover/google:text-white">G</span>
                <span className="text-xs text-white/80 group-hover/google:text-white">使用 Google 登录</span>
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
          还没有账号？{" "}
          <Link href="/register" className="relative inline-block font-medium text-white hover:text-white/80">
            注册
          </Link>
        </motion.p>
      </form>
    </AuthGlassScreen>
  );
}
