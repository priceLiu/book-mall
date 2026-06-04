import Link from "next/link";
import { EcomButtonPrimary, EcomButtonSecondaryLink } from "@/components/ui/ecom-button";
import { cn } from "@/lib/utils";
import type { EcomModuleDef } from "@/lib/modules/registry";

const tileBg: Record<EcomModuleDef["tile"], string> = {
  light: "bg-white text-[var(--ecom-ink)]",
  parchment: "bg-[var(--ecom-parchment)] text-[var(--ecom-ink)]",
  dark: "bg-[var(--ecom-tile)] text-white",
};

export function ProductTile({ module }: { module: EcomModuleDef }) {
  const dark = module.tile === "dark";
  return (
    <section
      className={cn(
        "flex min-h-[min(72vh,640px)] flex-col items-center justify-center px-6 py-20 text-center md:px-20",
        tileBg[module.tile],
      )}
    >
      <h2 className="text-[40px] font-semibold leading-[1.1] tracking-tight">
        {module.title}
      </h2>
      <p
        className={cn(
          "mt-3 max-w-xl text-[28px] font-normal leading-snug",
          dark ? "text-[#cccccc]" : "text-[var(--ecom-muted)]",
        )}
      >
        {module.tagline}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href={module.href}>
          <EcomButtonPrimary size="lg">开始制作</EcomButtonPrimary>
        </Link>
        <EcomButtonSecondaryLink href={module.href} dark={dark} size="lg">
          了解更多
        </EcomButtonSecondaryLink>
      </div>
    </section>
  );
}
