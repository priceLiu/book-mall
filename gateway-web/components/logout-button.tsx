"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ collapsed }: { collapsed?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={`gw-btn-ghost text-sm ${collapsed ? "w-full px-2 py-2" : "w-full"}`}
      disabled={loading}
      onClick={onLogout}
      title={collapsed ? "退出登录" : undefined}
      aria-label="退出登录"
    >
      {loading ? "…" : collapsed ? "退" : "退出登录"}
    </button>
  );
}
