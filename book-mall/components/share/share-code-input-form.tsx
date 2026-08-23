"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ShareCodeInputForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!normalized) {
      setError("请输入分享码");
      return;
    }
    setError(null);
    router.push(`/code/${encodeURIComponent(normalized)}`);
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4">
      <label className="block text-sm font-medium text-[#1f2328]">
        分享码
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="输入 8 位邀请码或 10 位工作流码"
          className="mt-2 w-full rounded-lg border border-[#d0d7de] px-3 py-2.5 text-lg tracking-widest"
          maxLength={16}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="w-full rounded-lg bg-[#8957e5] py-2.5 text-sm font-medium text-white hover:bg-[#7c4fd6]"
      >
        兑换
      </button>
    </form>
  );
}
