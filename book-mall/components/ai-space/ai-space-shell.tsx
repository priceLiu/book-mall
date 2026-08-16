"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { AiSpaceTabNav } from "@/components/ai-space/ai-space-tab-nav";
import { AI_SPACE_TAB_DESCRIPTIONS, normalizeAiSpaceTab } from "@/lib/ai-space/ai-space-tabs";

export function AiSpaceShell({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const tab = normalizeAiSpaceTab(searchParams.get("tab") ?? undefined);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col bg-[#f6f8fa]">
      <header className="shrink-0 border-b border-[#d0d7de] bg-white">
        <div className="flex flex-wrap items-start gap-3 px-4 pb-0 pt-3 md:px-6 lg:px-8">
          <Link
            href="/account"
            className="mt-0.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-sm text-[#656d76] transition hover:bg-[#f6f8fa] hover:text-[#1f2328] md:hidden"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            个人中心
          </Link>
          <div className="min-w-0 flex-1 space-y-1 pb-2">
            <h1 className="site-app-section-title">我的 AI 空间</h1>
            <p className="text-sm leading-relaxed text-[#656d76] lg:max-w-4xl">
              {AI_SPACE_TAB_DESCRIPTIONS[tab]}
            </p>
          </div>
        </div>
        <div className="px-4 md:px-6 lg:px-8">
          <AiSpaceTabNav active={tab} />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-6 pb-24 md:px-6 lg:px-8">
        <div className="w-full min-w-0">{children}</div>
      </main>
    </div>
  );
}
