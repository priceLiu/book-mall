"use client";

import { useEffect } from "react";

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[canvas-web/projects]", error);
  }, [error]);

  return (
    <div className="canvas-page flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-lg font-medium text-white">画布列表加载失败</h1>
      <p className="max-w-md text-sm text-[var(--canvas-muted)]">
        页面发生客户端异常。常见原因：主站 API 返回格式异常、登录令牌失效，或 canvas-web
        未配置 <code className="text-white/80">NEXT_PUBLIC_BOOK_MALL_URL</code>。
        请打开浏览器开发者工具（F12）→ Console 查看具体报错。
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
        >
          重试
        </button>
        <a
          href="/projects"
          className="rounded-lg border border-[var(--canvas-accent)]/40 px-4 py-2 text-sm text-[var(--canvas-accent)] hover:bg-[var(--canvas-accent)]/10"
        >
          刷新页面
        </a>
      </div>
    </div>
  );
}
