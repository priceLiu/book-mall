import Link from "next/link";
import { PricingFormulaCard } from "@/components/pricing/pricing-formula-card";
import { PricingTable } from "@/components/pricing/pricing-table";
import type { PricingRow } from "@/components/pricing/pricing-table";

type Props = {
  aiTryonRows: PricingRow[];
  otherToolRows: PricingRow[];
  minBilledVideoSec: number;
  /** false：隐藏云挂牌价、系数、公式（个人中心入口或非管理员） */
  showPricingInternals: boolean;
};

/**
 * 价格公示 · 按次扣费（整合一节）：共用公式说明 + 试衣完整价目 + 其他工具价目。
 */
export function PricingDisclosureMeteredSection({
  aiTryonRows,
  otherToolRows,
  minBilledVideoSec,
  showPricingInternals,
}: Props) {
  return (
    <section id="metered-pricing" className="mt-12 scroll-mt-24 space-y-8">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">二、按次扣费单价（工具）</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          以下与主站计费结算同源；实际扣费以调用成功为准。
          {showPricingInternals ? (
            <>
              平台单价 = 云挂牌成本 × M（当前 M = 2）。
            </>
          ) : (
            <>
              下表「平台单价」「点数」为对外零售参考；实际扣费以调用成功为准。
            </>
          )}{" "}
          试衣模型见{" "}
          <Link href="#ai-tryon" className="text-primary underline">
            本节 · AI 试衣
          </Link>
          （含阶梯完整价目）；文生图、图生视频、视觉分析等见{" "}
          <Link href="#all-tools" className="text-primary underline">
            本节 · 其他工具
          </Link>
          。
        </p>
        <nav
          className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
          aria-label="按次扣费快速导航"
        >
          <Link href="#ai-tryon" className="font-medium text-primary underline">
            AI 试衣（完整价目）
          </Link>
          <Link href="#all-tools" className="text-primary underline">
            其他工具
          </Link>
        </nav>
        {showPricingInternals ? <PricingFormulaCard /> : null}
      </div>

      <div id="ai-tryon" className="scroll-mt-28 space-y-4">
        <div className="space-y-2 border-l-4 border-primary pl-4">
          <h3 className="text-base font-semibold text-foreground">
            2.1 AI 试衣（阿里云百炼 · 完整价目）
          </h3>
          <p className="text-sm text-muted-foreground">
            含基础版、Plus、图片分割、图片精修共 4 类模型；精修（
            <code className="text-xs">aitryon-refiner</code>）按账户 UTC 自然月累计生成张数分档，下表列出全部阶梯档位。
          </p>
        </div>
        {aiTryonRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无试衣价目数据。</p>
        ) : (
          <PricingTable rows={aiTryonRows} showPlatformCostColumns={showPricingInternals} />
        )}
        <p className="text-xs text-muted-foreground">
          计费键 <code className="text-xs">fitting-room__ai-fit</code> /{" "}
          <code className="text-xs">try_on</code>；模型由 <code className="text-xs">modelId</code>{" "}
          区分。工具站「价格说明」指向本小节。
        </p>
      </div>

      <div id="all-tools" className="scroll-mt-28 space-y-4">
        <div className="space-y-2 border-l-4 border-border pl-4">
          <h3 className="text-base font-semibold text-foreground">2.2 其他工具</h3>
          <p className="text-sm text-muted-foreground">
            文生图、图生视频、视觉分析等；不含{" "}
            <Link href="#ai-tryon" className="text-primary underline">
              AI 试衣
            </Link>
            。
          </p>
        </div>
        {otherToolRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无其他工具价目数据。</p>
        ) : (
          <PricingTable rows={otherToolRows} showPlatformCostColumns={showPricingInternals} />
        )}
        <p className="text-xs text-muted-foreground">
          视频按「输出秒数」计费（不足 {minBilledVideoSec} 秒按 {minBilledVideoSec}{" "}
          秒兜底）；图片按张；Token 类按调用次数计点。
        </p>
      </div>
    </section>
  );
}
