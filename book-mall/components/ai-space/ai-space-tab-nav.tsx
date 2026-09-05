import Link from "next/link";

import { AI_SPACE_TABS, type AiSpaceTabId } from "@/lib/ai-space/ai-space-tabs";

export function AiSpaceTabNav({ active }: { active: AiSpaceTabId }) {
  return (
    <nav className="-mx-1 mb-5 flex flex-wrap gap-x-1 gap-y-0 border-b border-[#d0d7de] overflow-x-auto">
      {AI_SPACE_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={`/account/ai-space?tab=${tab.id}`}
            // 每个 tab 都是 force-dynamic 且要查库，鼠标划过就预取等于把
            // 一排 tab 的 SQL 全跑一遍，白白抢连接池（合成台曾因此卡到 60s+）
            prefetch={false}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "-mb-px border-b-2 border-[#fd8c73] px-3 py-2 text-sm font-semibold text-[#1f2328]"
                : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-[#656d76] hover:text-[#1f2328]"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
