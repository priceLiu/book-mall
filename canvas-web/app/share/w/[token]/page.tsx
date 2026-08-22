"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { RequireAuth } from "@/components/auth/require-auth";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

type ShareMeta = {
  token: string;
  app: string;
  title: string | null;
  sharerName: string | null;
  enabled: boolean;
  expired: boolean;
};

export default function WorkflowSharePage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token?.trim();
  const router = useRouter();
  const base = useBookMallBaseUrl();
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!token || !base) return;
    const { url, init } = resolveBookMallBrowserRequest(
      base,
      `/api/platform/workflow-share/${encodeURIComponent(token)}`,
    );
    fetch(url, init)
      .then(async (r) => {
        if (!r.ok) throw new Error("分享不存在或已失效");
        return r.json() as Promise<ShareMeta>;
      })
      .then(setMeta)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, [token, base]);

  const claim = useCallback(async () => {
    if (!token || !base) return;
    setClaiming(true);
    setError(null);
    try {
      const { url, init } = resolveBookMallBrowserRequest(
        base,
        `/api/platform/workflow-share/${encodeURIComponent(token)}/claim`,
        { method: "POST" },
      );
      const r = await fetch(url, init);
      const data = (await r.json()) as {
        ok?: boolean;
        error?: string;
        redirectPath?: string;
      };
      if (!r.ok) throw new Error(data.error ?? "领取失败");
      if (data.redirectPath) {
        router.replace(data.redirectPath);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "领取失败");
    } finally {
      setClaiming(false);
    }
  }, [token, router, base]);

  return (
    <RequireAuth>
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16">
        <h1 className="text-xl font-semibold text-[var(--canvas-text)]">
          工作流分享
        </h1>
        {error ? (
          <p className="mt-4 text-sm text-red-500">{error}</p>
        ) : !meta ? (
          <p className="mt-4 text-sm text-[var(--canvas-muted)]">加载中…</p>
        ) : (
          <div className="mt-4 space-y-3 rounded-xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-5">
            <p className="text-sm text-[var(--canvas-muted)]">
              {meta.sharerName ? `${meta.sharerName} 分享的工作流` : "好友分享的工作流"}
            </p>
            <p className="text-base font-medium text-[var(--canvas-text)]">
              {meta.title ?? "画布项目"}
            </p>
            {!meta.enabled || meta.expired ? (
              <p className="text-sm text-amber-600">该分享链接已失效</p>
            ) : (
              <button
                type="button"
                disabled={claiming}
                onClick={() => void claim()}
                className="rounded-lg bg-[var(--canvas-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {claiming ? "正在复制…" : "复制到我的画布并打开"}
              </button>
            )}
          </div>
        )}
        <Link
          href="/projects"
          className="mt-6 text-sm text-[var(--canvas-accent)] hover:underline"
        >
          返回我的项目
        </Link>
      </main>
    </RequireAuth>
  );
}
