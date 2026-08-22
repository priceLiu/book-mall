"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function getBookMallBase(): string {
  return (
    process.env.NEXT_PUBLIC_BOOK_MALL_URL?.replace(/\/$/, "") ||
    process.env.MAIN_SITE_ORIGIN?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export default function EcomWorkflowSharePage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token?.trim();
  const router = useRouter();
  const [title, setTitle] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${getBookMallBase()}/api/platform/workflow-share/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("分享无效");
        return r.json() as Promise<{ title: string | null; enabled: boolean }>;
      })
      .then((m) => {
        setTitle(m.title);
        setEnabled(m.enabled);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, [token]);

  const claim = useCallback(async () => {
    if (!token) return;
    setError(null);
    const r = await fetch(
      `${getBookMallBase()}/api/platform/workflow-share/${encodeURIComponent(token)}/claim`,
      { method: "POST", credentials: "include" },
    );
    const data = (await r.json()) as { redirectPath?: string; error?: string };
    if (!r.ok) {
      setError(data.error ?? "请先登录后再领取");
      return;
    }
    if (data.redirectPath) router.replace(data.redirectPath);
  }, [token, router]);

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-xl font-semibold">工作流分享 · 电商工具箱</h1>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <p className="mt-2 text-sm text-gray-600">{title ?? "加载中…"}</p>
      {enabled ? (
        <button
          type="button"
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white"
          onClick={() => void claim()}
        >
          复制到我的分镜项目
        </button>
      ) : (
        <p className="mt-4 text-sm text-amber-700">链接已失效</p>
      )}
    </main>
  );
}
