"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { getBookMallBaseUrl } from "@/lib/book-mall-billing-url";

/**
 * 财务管理端 · 价格公示（统一入口）。
 *
 * 与个人中心 `/account/pricing`、前台 `/pricing-disclosure` 共用同一份「平台价目表」组件，
 * 整站只此一处展示；本页只做"打开 book-mall 公示页"的入口卡片，保持 finance-web 视觉统一。
 */
export default function AdminPricingDisclosurePage() {
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => {
    setBase(getBookMallBaseUrl() ?? null);
  }, []);

  const target = base ? `${base}/pricing-disclosure` : "/pricing-disclosure";
  const accountTarget = base ? `${base}/account/pricing` : "/account/pricing";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-[#e8e8e8] bg-white px-6 py-4">
        <h1 className="text-base font-medium text-[#262626]">价格公示</h1>
        <p className="mt-1 text-xs text-[#8c8c8c]">
          全站统一价目表（云挂牌价 × M = 平台零售价）。本页与个人中心、前台公示页共用同一组件、同一数据源，
          确保任何调整一次同步生效。
        </p>
      </header>
      <div className="flex-1 overflow-y-auto bg-[#f5f5f5] p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded border border-[#e8e8e8] bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#f0f0f0] pb-2">
              <span className="text-base font-medium text-[#262626]">
                平台价目表（前台公示）
              </span>
              <code className="rounded bg-[#fafafa] px-2 py-0.5 text-xs text-[#595959]">
                book-mall · /pricing-disclosure
              </code>
            </div>
            <p className="text-sm leading-relaxed text-[#595959]">
              对外公开的价目表，含 <strong className="text-[#262626]">云挂牌价（成本）</strong>、
              <strong className="text-[#262626]">系数 M</strong>、
              <strong className="text-[#262626]">平台单价</strong>、
              <strong className="text-[#262626]">公式</strong>、 厂商产品 / 商品；与个人中心数据源同源（普通用户个人中心不展示成本相关列）。
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={target}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded bg-[#1890ff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#40a9ff]"
              >
                打开公示页
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
              <Link
                href={accountTarget}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded border border-[#d9d9d9] bg-white px-3 py-1.5 text-sm text-[#262626] hover:border-[#1890ff] hover:text-[#1890ff]"
              >
                打开个人中心价目表
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            {base ? (
              <p className="mt-3 text-xs text-[#8c8c8c]">
                目标 origin：<code className="rounded bg-[#fafafa] px-1">{base}</code>
              </p>
            ) : (
              <p className="mt-3 text-xs text-[#a8071a]">
                未配置 <code className="rounded bg-white px-1">NEXT_PUBLIC_BOOK_MALL_URL</code>，链接将退化为相对路径。
              </p>
            )}
          </div>

          <div className="rounded border border-[#e8e8e8] bg-white p-5 shadow-sm text-sm text-[#595959]">
            <h2 className="mb-2 text-base font-medium text-[#262626]">字段对照</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-[#262626]">云挂牌价（成本）</strong>：来自云厂商官方挂牌（不计折扣），是平台的
                成本价基线，沉淀于 <code className="rounded bg-[#fafafa] px-1">ToolBillablePrice.schemeAUnitCostYuan</code>。
              </li>
              <li>
                <strong className="text-[#262626]">系数 M</strong>：默认 2，按工具 + 模型逐行可配，沉淀于{" "}
                <code className="rounded bg-[#fafafa] px-1">schemeAAdminRetailMultiplier</code>。
              </li>
              <li>
                <strong className="text-[#262626]">平台单价</strong> = 云挂牌价 × M；
                <strong className="text-[#262626]">点数</strong> 为该单价乘 100 取整后的单次/每单位参考扣点（按秒模型以秒计价，见公示说明）。
              </li>
              <li>
                视频按「输出秒数」计费（不足 5 秒按 5 秒兜底）；图片按张；Token 类按调用次数计点。
              </li>
              <li>
                价格调整即时生效，仅作用于生效时间之后的调用；历史扣费快照在 ToolBillingDetailLine.cloudRow 内。
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
