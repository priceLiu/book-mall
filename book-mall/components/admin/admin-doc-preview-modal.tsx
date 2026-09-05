"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

import { AdminRepoDocMarkdown } from "@/components/admin/admin-repo-doc-markdown";
import { Button } from "@/components/ui/button";

export function AdminDocPreviewModal({
  path,
  onClose,
}: {
  path: string;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch(`/api/admin/pending-features/doc?path=${encodeURIComponent(path)}`)
      .then(async (res) => {
        const j = (await res.json()) as { content?: string; error?: string };
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
        return j.content ?? "";
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-preview-title"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#d0d7de] bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 id="doc-preview-title" className="text-sm font-semibold text-[#1f2328] sm:text-base">
            文档预览
          </h2>
          <p className="truncate font-mono text-xs text-[#656d76]">{path}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose} className="shrink-0">
          <X className="mr-1 size-4" />
          关闭
        </Button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#fafbfc]">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:max-w-7xl lg:px-8">
          {loading ? (
            <p className="flex items-center gap-2 py-16 text-sm text-[#656d76]">
              <Loader2 className="size-4 animate-spin" />
              加载中…
            </p>
          ) : error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : content ? (
            <div className="rounded-xl border border-[#d0d7de] bg-white px-4 py-6 shadow-sm sm:px-8 sm:py-10">
              <AdminRepoDocMarkdown content={content} docPath={path} />
            </div>
          ) : (
            <p className="text-sm text-[#656d76]">文档为空</p>
          )}
        </div>
      </main>
    </div>
  );
}
