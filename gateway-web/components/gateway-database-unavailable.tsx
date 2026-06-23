export function GatewayDatabaseUnavailable({
  message,
}: {
  message?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0c] p-6">
      <div className="max-w-lg rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-8 text-center">
        <h1 className="text-lg font-semibold text-red-100">数据库暂不可用</h1>
        <p className="mt-3 text-sm leading-relaxed text-red-100/80">
          {message ??
            "Gateway 与 Canvas 均依赖 book-mall 的 PostgreSQL。当前连接超时或连接数已满，请稍后刷新。"}
        </p>
        <ul className="mt-4 space-y-2 text-left text-xs text-[var(--gw-muted)]">
          <li>1. 在终端重启：<code className="text-[var(--gw-ink)]">pnpm dev:all</code></li>
          <li>
            2. 若仍失败，先用{" "}
            <code className="text-[var(--gw-ink)]">pnpm dev:all:nopoll</code> 降低 poll 占用的连接数
          </li>
          <li>3. 检查腾讯云 CDB 实例状态、安全组与本机 IP 白名单</li>
        </ul>
        <a
          href="/dashboard"
          className="mt-6 inline-block rounded-md border border-[var(--gw-border)] px-4 py-2 text-sm text-[var(--gw-ink)] hover:bg-[var(--gw-hover)]"
        >
          重试
        </a>
      </div>
    </main>
  );
}
