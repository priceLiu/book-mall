"use client";

import { Sparkles } from "lucide-react";

/** 品牌图标 · 磨砂正圆，移动端不拉伸变形 */
export function QrBrandMark({
  variant = "default",
  className = "",
}: {
  variant?: "default" | "hero";
  className?: string;
}) {
  const variantClass = variant === "hero" ? "qr-brand-mark--hero" : "";
  return (
    <span className={`qr-brand-mark ${variantClass} ${className}`.trim()} aria-hidden>
      <Sparkles
        className="qr-brand-mark__icon"
        style={{ color: "var(--qr-brand)" }}
        strokeWidth={1.75}
      />
    </span>
  );
}
