"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SubscribeHashScroll() {
  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return;
    const el = document.getElementById(raw);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return null;
}

export function SubscribePlanButton({
  planSlug,
  className,
  variant = "default",
  children,
}: {
  planSlug: "monthly" | "yearly";
  className?: string;
  variant?: "default" | "secondary" | "outline";
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const router = useRouter();

  function onClick() {
    if (status !== "authenticated") {
      router.push(
        `/login?callbackUrl=${encodeURIComponent(`/subscribe#${planSlug}`)}`,
      );
      return;
    }
    router.push(`/pay/mock-subscribe?plan=${planSlug}`);
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant={variant} className={className} onClick={onClick}>
        {children}
      </Button>
    </div>
  );
}
