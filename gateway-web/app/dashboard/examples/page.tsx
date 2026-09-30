import Link from "next/link";

import { ApiExamplesClient } from "@/components/guide/api-examples-client";
import { getGatewayPublicOrigin } from "@/lib/book-mall-base-url";

export default function DashboardApiExamplesPage() {
  const base =
    process.env.GATEWAY_PUBLIC_ORIGIN?.trim() ||
    getGatewayPublicOrigin() ||
    "http://localhost:3005";
  const apiBase = `${base.replace(/\/$/, "")}/api/v1`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--gw-ink)]">模型调用示例</h1>
        <p className="mt-1 text-sm text-[var(--gw-muted)]">
          用一把 <code className="text-[var(--gw-ink)]/80">sk-gw</code> 直接调 Gateway
          API。示例：GPT Image 2.0、Seedance 2.0、Wan 3.0、Qwen 3.0。{" "}
          <Link href="/dashboard/docs" className="text-[var(--gw-accent)] hover:underline">
            接入文档
          </Link>
          {" · "}
          <Link href="/dashboard/playground" className="text-[var(--gw-accent)] hover:underline">
            API 调试
          </Link>
        </p>
      </div>
      <ApiExamplesClient apiBase={apiBase} />
    </div>
  );
}
