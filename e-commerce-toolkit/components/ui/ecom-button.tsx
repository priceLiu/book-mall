"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import {
  ecomButtonSizeClass,
  type EcomButtonSize,
} from "@/lib/ecom-button-sizes";
import { cn } from "@/lib/utils";

type MotionButtonRest = Omit<
  HTMLMotionProps<"button">,
  "children" | "onToggle" | "animate" | "variants" | "transition" | "whileTap" | "whileHover"
>;

const SPRING = { duration: 0.6, type: "spring" as const };

/** 翻转 / 主按钮背景态（与 design/BUTTON.md 一致） */
export const ecomFlipVariants = {
  one: {
    backgroundColor: "var(--ecom-btn-fill)",
    color: "var(--ecom-btn-on-fill)",
  },
  two: {
    backgroundColor: "var(--ecom-btn-alt-fill)",
    color: "var(--ecom-btn-alt-on-fill)",
  },
} as const;

const pillShellClass =
  "relative w-full cursor-pointer font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ecom-primary-focus)] disabled:cursor-not-allowed disabled:opacity-50";

function pillSizeClass(size: EcomButtonSize) {
  return cn(pillShellClass, ecomButtonSizeClass(size));
}

/** 用于 `<a>` 等不可嵌套 `<button>` 的场景 */
export function ecomPrimaryLinkClass(size: EcomButtonSize = "sm", className?: string) {
  return cn(
    "inline-flex w-full max-w-[270px] items-center justify-center rounded-full bg-[var(--ecom-btn-fill)] font-medium text-[var(--ecom-btn-on-fill)] transition-transform hover:scale-105 active:scale-95",
    ecomButtonSizeClass(size),
    className,
  );
}

type FlipButtonProps = {
  text1: string;
  text2: string;
  /** 为 true 时展示 text1（背面） */
  active?: boolean;
  onToggle?: (next: boolean) => void;
  fullWidth?: boolean;
  size?: EcomButtonSize;
  className?: string;
  disabled?: boolean;
} & MotionButtonRest;

/** 双文案 3D 翻转胶囊按钮 */
export function EcomFlipButton({
  text1,
  text2,
  active = false,
  onToggle,
  fullWidth = true,
  size = "md",
  className,
  disabled,
  type = "button",
  onClick,
  ...rest
}: FlipButtonProps) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!disabled && onToggle) onToggle(!active);
    onClick?.(e);
  }

  return (
    <div className={cn(fullWidth && "w-full max-w-[270px]", className)}>
      <motion.button
        type={type}
        disabled={disabled}
        className={pillSizeClass(size)}
        style={{ borderRadius: 999, perspective: 600 }}
        onClick={handleClick}
        animate={active ? "two" : "one"}
        variants={ecomFlipVariants}
        transition={SPRING}
        whileTap={disabled ? undefined : { scale: 0.95 }}
        whileHover={disabled ? undefined : { scale: 1.05 }}
        {...rest}
      >
        <span className="block w-full" style={{ transformStyle: "preserve-3d" }}>
          <motion.span
            className="relative block w-full"
            animate={{ rotateX: active ? 180 : 0 }}
            transition={SPRING}
            style={{ transformStyle: "preserve-3d" }}
          >
            <span className="block" style={{ backfaceVisibility: "hidden" }}>
              {text2}
            </span>
            <span
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: "rotateX(180deg)", backfaceVisibility: "hidden" }}
            >
              {text1}
            </span>
          </motion.span>
        </span>
      </motion.button>
    </div>
  );
}

type PrimaryProps = {
  children: React.ReactNode;
  /** 背面文案（如「生成中…」）；与 flipActive 联用 */
  altLabel?: React.ReactNode;
  /** 受控翻转，为 true 时显示 altLabel */
  flipActive?: boolean;
  fullWidth?: boolean;
  size?: EcomButtonSize;
  className?: string;
} & MotionButtonRest;

/** 主 CTA：单态胶囊；可选加载翻转 */
export function EcomButtonPrimary({
  children,
  altLabel,
  flipActive = false,
  fullWidth = false,
  size = "md",
  className,
  disabled,
  type = "button",
  ...rest
}: PrimaryProps) {
  const label = String(children);
  const alt = altLabel != null ? String(altLabel) : null;

  if (alt) {
    return (
      <EcomFlipButton
        text1={alt}
        text2={label}
        active={flipActive}
        fullWidth={fullWidth}
        size={size}
        className={className}
        disabled={disabled}
        type={type}
        {...rest}
      />
    );
  }

  return (
    <div className={cn(fullWidth && "w-full max-w-[270px]", className)}>
      <motion.button
        type={type}
        disabled={disabled}
        className={pillSizeClass(size)}
        style={{ borderRadius: 999 }}
        animate="one"
        variants={ecomFlipVariants}
        transition={SPRING}
        whileTap={disabled ? undefined : { scale: 0.95 }}
        whileHover={disabled ? undefined : { scale: 1.05 }}
        {...rest}
      >
        {children}
      </motion.button>
    </div>
  );
}

type SecondaryProps = {
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
  size?: EcomButtonSize;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>;

/** 描边胶囊次要按钮（Link） */
export function EcomButtonSecondaryLink({
  children,
  className,
  dark = false,
  size = "md",
  ...rest
}: SecondaryProps) {
  return (
    <a
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-[var(--ecom-primary)] font-medium transition-transform hover:scale-105 active:scale-95",
        ecomButtonSizeClass(size, "secondary"),
        dark ? "text-[var(--ecom-primary-on-dark,#2997ff)]" : "text-[var(--ecom-primary)]",
        className,
      )}
      {...rest}
    >
      {children}
    </a>
  );
}
