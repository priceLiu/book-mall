import Link from "next/link";
import type { Metadata } from "next";

import { OperationGuideContent } from "@/components/guide/operation-guide";

export const metadata: Metadata = {
  title: "操作指引",
  description:
    "Gateway 断直连配置：厂商凭证、sk-gw、Book 关联与 Canvas / 工具站使用流程",
};

export default function PublicGuidePage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-[var(--gw-surface)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-sm font-semibold text-white">
            Gateway 控制台
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/guide"
              className="text-[var(--gw-accent)]"
              aria-current="page"
            >
              操作指引
            </Link>
            <Link
              href="/login"
              className="text-[var(--gw-muted)] hover:text-white"
            >
              登录
            </Link>
          </nav>
        </div>
      </header>
      <main className="px-4 py-8">
        <OperationGuideContent />
      </main>
    </div>
  );
}
