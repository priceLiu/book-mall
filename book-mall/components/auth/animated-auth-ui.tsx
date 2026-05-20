"use client";

import {
  memo,
  forwardRef,
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type ChangeEvent,
} from "react";
import Image from "next/image";
import {
  motion,
  useAnimation,
  useInView,
  useMotionTemplate,
  useMotionValue,
} from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// —— Input（鼠标跟随蓝光描边） ——

export const AuthAnimatedInput = memo(
  forwardRef(function AuthAnimatedInput(
    { className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>,
    ref: React.ForwardedRef<HTMLInputElement>
  ) {
    const radius = 100;
    const [visible, setVisible] = useState(false);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({
      currentTarget,
      clientX,
      clientY,
    }: React.MouseEvent<HTMLDivElement>) {
      const { left, top } = currentTarget.getBoundingClientRect();
      mouseX.set(clientX - left);
      mouseY.set(clientY - top);
    }

    return (
      <motion.div
        style={{
          background: useMotionTemplate`
            radial-gradient(
              ${visible ? `${radius}px` : "0px"} circle at ${mouseX}px ${mouseY}px,
              #3b82f6,
              transparent 80%
            )
          `,
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="group/input rounded-lg p-[2px] transition duration-300"
      >
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border-none bg-gray-50 px-3 py-2 text-sm text-black shadow-none transition duration-300",
            "placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "dark:bg-zinc-800 dark:text-white dark:placeholder:text-neutral-500 dark:shadow-[0px_0px_1px_1px_#404040] dark:focus-visible:ring-neutral-600",
            className
          )}
          ref={ref}
          {...props}
        />
      </motion.div>
    );
  })
);
AuthAnimatedInput.displayName = "AuthAnimatedInput";

// —— BoxReveal ——

type BoxRevealProps = {
  children: ReactNode;
  width?: string;
  boxColor?: string;
  duration?: number;
  overflow?: string;
  position?: string;
  className?: string;
};

export const BoxReveal = memo(function BoxReveal({
  children,
  width = "fit-content",
  boxColor = "hsl(var(--primary))",
  duration,
  overflow = "hidden",
  position = "relative",
  className,
}: BoxRevealProps) {
  const mainControls = useAnimation();
  const slideControls = useAnimation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      slideControls.start("visible");
      mainControls.start("visible");
    } else {
      slideControls.start("hidden");
      mainControls.start("hidden");
    }
  }, [isInView, mainControls, slideControls]);

  return (
    <section
      ref={ref}
      style={{
        position: position as "relative" | "absolute" | "fixed" | "sticky" | "static",
        width,
        overflow: overflow as "hidden" | "visible" | "clip" | "scroll" | "auto",
      }}
      className={className}
    >
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 75 },
          visible: { opacity: 1, y: 0 },
        }}
        initial="hidden"
        animate={mainControls}
        transition={{ duration: duration ?? 0.5, delay: 0.25 }}
      >
        {children}
      </motion.div>
      <motion.div
        variants={{ hidden: { left: 0 }, visible: { left: "100%" } }}
        initial="hidden"
        animate={slideControls}
        transition={{ duration: duration ?? 0.5, ease: "easeIn" }}
        style={{
          position: "absolute",
          top: 4,
          bottom: 4,
          left: 0,
          right: 0,
          zIndex: 20,
          background: boxColor,
          borderRadius: 4,
        }}
      />
    </section>
  );
});

// —— Ripple ——

type RippleProps = {
  mainCircleSize?: number;
  mainCircleOpacity?: number;
  numCircles?: number;
  /** 同心圆间距（默认 70，随舞台缩放传入） */
  rippleStep?: number;
  /** 底部渐隐：登录标题居中需保持完整动效，仅用轻微边缘淡出 */
  maskBottom?: boolean;
  className?: string;
};

/** 与涟漪同心的轨道路径（浅蓝描边，对齐图标轨道） */
export const OrbitPathRings = memo(function OrbitPathRings({
  radiiPx,
  className = "",
}: {
  radiiPx: number[];
  className?: string;
}) {
  if (radiiPx.length === 0) return null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    >
      {radiiPx.map((r, i) => (
        <circle
          key={`${r}-${i}`}
          cx="50%"
          cy="50%"
          r={r}
          fill="none"
          className="stroke-sky-500/28 dark:stroke-sky-300/15"
          strokeWidth={1}
          strokeDasharray={i === radiiPx.length - 1 ? "6 4" : undefined}
        />
      ))}
    </svg>
  );
});

export const Ripple = memo(function Ripple({
  mainCircleSize = 210,
  mainCircleOpacity = 0.38,
  numCircles = 5,
  rippleStep = 70,
  maskBottom = false,
  className = "",
}: RippleProps) {
  return (
    <section
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        "bg-sky-100/40 dark:bg-sky-400/[0.02]",
        maskBottom &&
          "[mask-image:linear-gradient(to_bottom,black_88%,transparent_100%)]",
        className
      )}
    >
      {Array.from({ length: numCircles }, (_, i) => {
        const size = mainCircleSize + i * rippleStep;
        const animationDelay = `${i * 0.1}s`;
        const borderStyle = i === numCircles - 1 ? "dashed" : "solid";
        return (
          <span
            key={i}
            className={cn(
              "absolute animate-ripple rounded-full border bg-transparent",
              "border-sky-500/30 opacity-55 dark:border-sky-300/18 dark:opacity-40"
            )}
            style={{
              width: `${size}px`,
              height: `${size}px`,
              animationDelay,
              borderStyle,
              borderWidth: "1px",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}
    </section>
  );
});

// —— OrbitingCircles ——

type OrbitingCirclesProps = {
  className?: string;
  children: ReactNode;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
};

export const OrbitingCircles = memo(function OrbitingCircles({
  className,
  children,
  reverse = false,
  duration = 20,
  delay = 10,
  radius = 50,
}: OrbitingCirclesProps) {
  return (
    <div className={cn("pointer-events-none absolute left-1/2 top-1/2 z-10", className)}>
      <div
        style={
          {
            "--duration": duration,
            animationDelay: `calc(${-delay}s)`,
          } as React.CSSProperties
        }
        className={cn(
          "h-0 w-0 animate-orbit transform-gpu",
          reverse && "[animation-direction:reverse]"
        )}
      >
        <div
          className="absolute left-0 -translate-x-1/2"
          style={{ top: -radius, width: "max-content" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
});

/** 品牌标题渐变（对齐 modern-animated-sign-in：上亮下融入背景） */
export const AUTH_BRANDING_TITLE_GRADIENT = cn(
  "bg-gradient-to-b from-black to-gray-300/80 bg-clip-text text-transparent",
  "dark:from-white dark:to-slate-900/10"
);

// —— TechOrbitDisplay ——

export type OrbitIconConfig = {
  className?: string;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
  reverse?: boolean;
  component: () => React.ReactNode;
};

export const TechOrbitDisplay = memo(function TechOrbitDisplay({
  iconsArray,
  text = "智选 AI MALL",
  titleClassName = "text-7xl",
}: {
  iconsArray: OrbitIconConfig[];
  text?: string;
  titleClassName?: string;
}) {
  return (
    <section className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden">
      {iconsArray.map((icon, index) => (
        <OrbitingCircles
          key={index}
          className={icon.className}
          duration={icon.duration}
          delay={icon.delay}
          radius={icon.radius}
          reverse={icon.reverse}
        >
          {icon.component()}
        </OrbitingCircles>
      ))}
      <span
        className={cn(
          "pointer-events-none relative z-30 whitespace-pre-wrap text-center font-semibold leading-none tracking-tight",
          AUTH_BRANDING_TITLE_GRADIENT,
          titleClassName
        )}
      >
        {text}
      </span>
    </section>
  );
});

export function BottomGradient() {
  return (
    <>
      <span className="pointer-events-none absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
      <span className="pointer-events-none absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
    </>
  );
}

export const AuthAnimatedLabel = memo(function AuthAnimatedLabel({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none text-neutral-800 dark:text-neutral-200",
        className
      )}
      {...props}
    />
  );
});

/** Google 登录按钮（可选） */
export function GoogleAuthButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <BoxReveal boxColor="hsl(var(--primary))" duration={0.3} overflow="visible" width="unset">
      <button
        type="button"
        onClick={onClick}
        className="group/btn relative h-10 w-full rounded-md border border-neutral-300 bg-transparent font-medium outline-none hover:cursor-pointer dark:border-neutral-700"
      >
        <span className="flex h-full w-full items-center justify-center gap-3">
          <Image
            src="https://cdn1.iconfinder.com/data/icons/google-s-logo/150/Google_Icons-09-512.png"
            width={22}
            height={22}
            alt=""
          />
          {label}
        </span>
        <BottomGradient />
      </button>
    </BoxReveal>
  );
}

export type AnimatedAuthField = {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  placeholder?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
};

export const AnimatedAuthFields = memo(function AnimatedAuthFields({
  fields,
  passwordVisible,
  onTogglePassword,
}: {
  fields: AnimatedAuthField[];
  passwordVisible: boolean;
  onTogglePassword: () => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-4">
      {fields.map((field) => (
        <section key={field.name} className="flex flex-col gap-2">
          <BoxReveal boxColor="hsl(var(--primary))" duration={0.3}>
            <AuthAnimatedLabel htmlFor={field.name}>
              {field.label}
              {field.required !== false ? (
                <span className="text-red-500" aria-hidden>
                  {" "}
                  *
                </span>
              ) : null}
            </AuthAnimatedLabel>
          </BoxReveal>
          <BoxReveal
            width="100%"
            boxColor="hsl(var(--primary))"
            duration={0.3}
            className="flex w-full flex-col space-y-2"
          >
            <div className="relative">
              <AuthAnimatedInput
                id={field.name}
                name={field.name}
                type={
                  field.type === "password"
                    ? passwordVisible
                      ? "text"
                      : "password"
                    : field.type
                }
                placeholder={field.placeholder}
                value={field.value}
                onChange={field.onChange}
                required={field.required !== false}
                autoComplete={field.type === "email" ? "email" : field.type === "password" ? "current-password" : undefined}
                className={field.type === "password" ? "pr-10" : undefined}
              />
              {field.type === "password" ? (
                <button
                  type="button"
                  onClick={onTogglePassword}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
                  aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
                >
                  {passwordVisible ? (
                    <Eye className="h-5 w-5" />
                  ) : (
                    <EyeOff className="h-5 w-5" />
                  )}
                </button>
              ) : null}
            </div>
          </BoxReveal>
        </section>
      ))}
    </div>
  );
});

export function AuthSubmitButton({
  children,
  disabled,
  loading,
}: {
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <BoxReveal width="100%" boxColor="hsl(var(--primary))" duration={0.3} overflow="visible">
      <button
        type="submit"
        disabled={disabled || loading}
        className="group/btn relative block h-10 w-full rounded-md bg-gradient-to-br from-zinc-200 to-zinc-100 font-medium text-black shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] outline-none hover:cursor-pointer disabled:opacity-60 dark:from-zinc-900 dark:to-zinc-800 dark:text-white dark:shadow-[0px_1px_0px_0px_#27272a_inset,0px_-1px_0px_0px_#27272a_inset]"
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </span>
        ) : (
          children
        )}
        <BottomGradient />
      </button>
    </BoxReveal>
  );
}

export function AuthOrDivider() {
  return (
    <BoxReveal boxColor="hsl(var(--primary))" duration={0.3} width="100%">
      <section className="flex items-center gap-4">
        <hr className="flex-1 border border-dashed border-neutral-300 dark:border-neutral-700" />
        <p className="text-sm text-neutral-600 dark:text-neutral-300">或</p>
        <hr className="flex-1 border border-dashed border-neutral-300 dark:border-neutral-700" />
      </section>
    </BoxReveal>
  );
}
