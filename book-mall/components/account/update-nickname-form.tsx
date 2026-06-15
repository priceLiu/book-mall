"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UpdateNicknameForm({ initialName }: { initialName: string | null }) {
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState(initialName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        name?: string | null;
      };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "保存失败");
        return;
      }
      const nextName = data.name ?? null;
      setName(nextName ?? "");
      await update({ name: nextName ?? undefined });
      setSuccess("昵称已更新");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="nickname">昵称</Label>
        <Input
          id="nickname"
          maxLength={64}
          placeholder="请输入昵称"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {success}
        </p>
      ) : null}
      <Button type="submit" size="sm" variant="subscription" disabled={loading}>
        {loading ? "保存中…" : "保存昵称"}
      </Button>
    </form>
  );
}
