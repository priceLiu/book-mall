"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { type LucideIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex items-center justify-center rounded-full border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-violet-600 text-white shadow-sm hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500",
        secondary:
          "border-transparent bg-zinc-100 text-zinc-900 hover:bg-zinc-200/90 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
        outline:
          "border-zinc-300 bg-white text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
        ghost:
          "border-transparent text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
        destructive:
          "border-transparent bg-red-600 text-white shadow-sm hover:bg-red-700 dark:hover:bg-red-600",
      },
      size: {
        sm: "h-6 gap-1 px-2.5 text-xs",
        default: "h-7 gap-1.5 px-3 text-sm",
        lg: "h-8 gap-2 px-4 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ChipProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof chipVariants> & {
    icon?: LucideIcon;
    iconPosition?: "left" | "right";
    dismissible?: boolean;
    onDismiss?: () => void;
  };

const Chip = React.forwardRef<HTMLDivElement, ChipProps>(
  (
    {
      className,
      variant,
      size,
      icon: Icon,
      iconPosition = "left",
      dismissible = false,
      onDismiss,
      children,
      ...props
    },
    ref,
  ) => {
    const iconSize = size === "sm" ? 12 : size === "lg" ? 14 : 12;
    const closeIconSize = size === "sm" ? 10 : size === "lg" ? 12 : 10;

    const handleDismiss = (e: React.MouseEvent) => {
      e.stopPropagation();
      onDismiss?.();
    };

    return (
      <div
        ref={ref}
        className={cn(chipVariants({ variant, size }), className)}
        {...props}
      >
        {Icon && iconPosition === "left" ? (
          <Icon size={iconSize} className="shrink-0" strokeWidth={2} />
        ) : null}
        {children}
        {Icon && iconPosition === "right" && !dismissible ? (
          <Icon size={iconSize} className="shrink-0" strokeWidth={2} />
        ) : null}
        {dismissible ? (
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
            aria-label="移除"
          >
            <X size={closeIconSize} strokeWidth={2} />
          </button>
        ) : null}
      </div>
    );
  },
);

Chip.displayName = "Chip";

export { Chip, chipVariants };
