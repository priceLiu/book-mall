"use client";

import { type ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

/**
 * 全屏黑灰渐变 + 玻璃拟态卡片容器（登录 / 注册页共用）
 */
export function AuthGlassScreen({ children }: { children: ReactNode }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [10, -10]);
  const rotateY = useTransform(mouseX, [-300, 300], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div className="relative -mt-4 flex min-h-[calc(100vh-3.5rem)] w-full items-start justify-center overflow-hidden bg-zinc-100 pt-[14vh] sm:-mt-5 sm:min-h-[calc(100vh-4rem)] sm:pt-[16vh] dark:bg-black">
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-300/90 via-zinc-100 to-white dark:from-black dark:via-zinc-950/85 dark:to-zinc-600/30" />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      <div className="pointer-events-none absolute top-0 left-1/2 h-[50vh] w-[120vh] -translate-x-1/2 rounded-b-[50%] bg-zinc-400/30 blur-[80px] dark:bg-zinc-800/25" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 h-[50vh] w-[100vh] -translate-x-1/2 rounded-b-full bg-zinc-300/25 blur-[60px] dark:bg-zinc-700/20"
        animate={{
          opacity: [0.15, 0.3, 0.15],
          scale: [0.98, 1.02, 0.98],
        }}
        transition={{
          duration: 8,
          repeat: Number.POSITIVE_INFINITY,
          repeatType: "mirror",
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 h-[90vh] w-[90vh] -translate-x-1/2 rounded-t-full bg-zinc-200/50 blur-[60px] dark:bg-zinc-400/25"
        animate={{
          opacity: [0.3, 0.5, 0.3],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 6,
          repeat: Number.POSITIVE_INFINITY,
          repeatType: "mirror",
          delay: 1,
        }}
      />

      <div className="pointer-events-none absolute top-[12%] left-1/4 h-72 w-72 animate-pulse rounded-full bg-zinc-400/20 opacity-40 blur-[100px] dark:bg-zinc-700/10 dark:opacity-30" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute right-1/4 bottom-[8%] h-96 w-96 animate-pulse rounded-full bg-zinc-300/25 opacity-50 blur-[100px] [animation-delay:1s] dark:bg-zinc-400/15"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-sm px-4"
        style={{ perspective: 1500 }}
      >
        <motion.div
          className="relative"
          style={{ rotateX, rotateY }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div className="group relative">
            <motion.div
              aria-hidden
              className="absolute -inset-[1px] rounded-2xl opacity-0 transition-opacity duration-700 group-hover:opacity-70"
              animate={{
                boxShadow: [
                  "0 0 10px 2px rgba(255,255,255,0.03)",
                  "0 0 15px 5px rgba(255,255,255,0.05)",
                  "0 0 10px 2px rgba(255,255,255,0.03)",
                ],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: 4,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
                repeatType: "mirror",
              }}
            />

            <div className="absolute -inset-[1px] overflow-hidden rounded-2xl">
              <motion.div
                aria-hidden
                className="absolute top-0 left-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-foreground/30 to-transparent opacity-50 dark:via-white dark:opacity-70"
                initial={{ filter: "blur(2px)" }}
                animate={{
                  left: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                  filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"],
                }}
                transition={{
                  left: {
                    duration: 2.5,
                    ease: "easeInOut",
                    repeat: Number.POSITIVE_INFINITY,
                    repeatDelay: 1,
                  },
                  opacity: {
                    duration: 1.2,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "mirror",
                  },
                  filter: {
                    duration: 1.5,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "mirror",
                  },
                }}
              />
              <motion.div
                aria-hidden
                className="absolute top-0 right-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-foreground/30 to-transparent opacity-50 dark:via-white dark:opacity-70"
                initial={{ filter: "blur(2px)" }}
                animate={{
                  top: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                  filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"],
                }}
                transition={{
                  top: {
                    duration: 2.5,
                    ease: "easeInOut",
                    repeat: Number.POSITIVE_INFINITY,
                    repeatDelay: 1,
                    delay: 0.6,
                  },
                  opacity: {
                    duration: 1.2,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "mirror",
                    delay: 0.6,
                  },
                  filter: {
                    duration: 1.5,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "mirror",
                    delay: 0.6,
                  },
                }}
              />
              <motion.div
                aria-hidden
                className="absolute right-0 bottom-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-foreground/30 to-transparent opacity-50 dark:via-white dark:opacity-70"
                initial={{ filter: "blur(2px)" }}
                animate={{
                  right: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                  filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"],
                }}
                transition={{
                  right: {
                    duration: 2.5,
                    ease: "easeInOut",
                    repeat: Number.POSITIVE_INFINITY,
                    repeatDelay: 1,
                    delay: 1.2,
                  },
                  opacity: {
                    duration: 1.2,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "mirror",
                    delay: 1.2,
                  },
                  filter: {
                    duration: 1.5,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "mirror",
                    delay: 1.2,
                  },
                }}
              />
              <motion.div
                aria-hidden
                className="absolute bottom-0 left-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-foreground/30 to-transparent opacity-50 dark:via-white dark:opacity-70"
                initial={{ filter: "blur(2px)" }}
                animate={{
                  bottom: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                  filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"],
                }}
                transition={{
                  bottom: {
                    duration: 2.5,
                    ease: "easeInOut",
                    repeat: Number.POSITIVE_INFINITY,
                    repeatDelay: 1,
                    delay: 1.8,
                  },
                  opacity: {
                    duration: 1.2,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "mirror",
                    delay: 1.8,
                  },
                  filter: {
                    duration: 1.5,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "mirror",
                    delay: 1.8,
                  },
                }}
              />
            </div>

            <div className="absolute -inset-[0.5px] rounded-2xl bg-gradient-to-r from-foreground/[0.04] via-foreground/[0.08] to-foreground/[0.04] opacity-0 transition-opacity duration-500 group-hover:opacity-70 dark:from-white/[0.03] dark:via-white/[0.07] dark:to-white/[0.03]" />

            <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-xl backdrop-blur-xl dark:border-white/[0.05] dark:bg-black/40 dark:shadow-2xl">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.05] dark:hidden"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, rgba(0,0,0,0.1) 0.5px, transparent 0.5px), linear-gradient(45deg, rgba(0,0,0,0.1) 0.5px, transparent 0.5px)",
                  backgroundSize: "30px 30px",
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 hidden opacity-[0.03] dark:block"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)",
                  backgroundSize: "30px 30px",
                }}
              />
              <div className="relative z-10">{children}</div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/** 登录 / 注册输入框（随浅色 / 深色主题切换） */
export function AuthGlassInput({
  className = "",
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="auth-glass-input"
      className={
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-10 w-full min-w-0 rounded-lg border border-transparent bg-zinc-200/70 px-3 py-1 pl-10 pr-3 text-base text-foreground shadow-none transition-all duration-300 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium focus:border-zinc-300 focus:bg-white focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:border-white/20 dark:focus:bg-white/10 md:text-sm " +
        className
      }
      {...props}
    />
  );
}
