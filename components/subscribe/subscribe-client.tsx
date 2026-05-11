"use client";

import { useEffect, useState } from "react";
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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setMsg(null);
    if (status !== "authenticated") {
      router.push(
        `/login?callbackUrl=${encodeURIComponent(`/subscribe#${planSlug}`)}`,
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/dev/mock-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "支付流程失败");
        return;
      }
      router.push("/account");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        className={className}
        disabled={busy}
        onClick={onClick}
      >
        {busy ? "处理中…" : children}
      </Button>
      {msg ? <p className="text-sm text-destructive">{msg}</p> : null}
    </div>
  );
}
