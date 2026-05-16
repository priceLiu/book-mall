"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, LayoutGrid, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const billingChildren = [
  { href: "/fees/billing/overview", label: "账单概览" },
  { href: "/fees/billing/details", label: "账单详情" },
  { href: "/fees/billing/subscriptions", label: "账单订阅" },
];

export function FeesSidebar() {
  const pathname = usePathname();
  const [openFees, setOpenFees] = useState(true);
  const [openBill, setOpenBill] = useState(true);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-[#e8e8e8] bg-white text-sm text-[#333]">
      <div className="flex h-12 items-center border-b border-[#e8e8e8] px-3 font-medium text-[#1890ff]">
        <LayoutGrid className="mr-2 h-4 w-4" />
        财务控制台
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        <div className="px-2">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-[#f5f5f5]"
            onClick={() => setOpenFees((v) => !v)}
          >
            <span className="flex items-center gap-1">
              <Receipt className="h-4 w-4 text-[#595959]" />
              费用
            </span>
            {openFees ? (
              <ChevronDown className="h-4 w-4 text-[#8c8c8c]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[#8c8c8c]" />
            )}
          </button>
          {openFees && (
            <div className="ml-2 mt-0.5 border-l border-[#f0f0f0] pl-2">
              <button
                type="button"
                className="mt-1 flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-[#f5f5f5]"
                onClick={() => setOpenBill((v) => !v)}
              >
                <span>账单</span>
                {openBill ? (
                  <ChevronDown className="h-4 w-4 text-[#8c8c8c]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[#8c8c8c]" />
                )}
              </button>
              {openBill && (
                <ul className="mt-0.5 space-y-0.5">
                  {billingChildren.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "block rounded px-2 py-1.5 pl-3",
                            active
                              ? "bg-[#e6f7ff] text-[#1890ff]"
                              : "text-[#595959] hover:bg-[#f5f5f5]",
                          )}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </nav>
      <div className="border-t border-[#e8e8e8] p-2 text-xs text-[#8c8c8c]">
        finance-web · 演示数据
      </div>
    </aside>
  );
}
