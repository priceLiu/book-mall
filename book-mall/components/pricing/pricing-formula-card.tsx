/**
 * "公式说明卡片"：与共享 PricingTable 成对使用。
 * `showRetailCoefficient=false` 时略去系数 M 等对内口径（与 `/account/pricing` 普通用户视图一致）。
 */
export function PricingFormulaCard({
  showRetailCoefficient = true,
}: {
  showRetailCoefficient?: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-foreground">计价公式</h2>
        <span className="text-xs text-muted-foreground">单位：点（100 点 = ¥1）</span>
      </div>
      <ul className="mt-2 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
        <li>
          <span className="text-foreground/80">图片 / 试衣（按张）：</span>
          {showRetailCoefficient ? (
            <code className="ml-1 text-[11px]">成本 × 系数 × 100 → 取整（最少 1 点）</code>
          ) : (
            <span className="ml-1 text-[11px]">按输出张数与公示「点数」扣减（详见价格公示）。</span>
          )}
        </li>
        <li>
          <span className="text-foreground/80">视频（按秒）：</span>
          {showRetailCoefficient ? (
            <code className="ml-1 text-[11px]">成本/秒 × 系数 × 实际秒数 × 100 → 取整</code>
          ) : (
            <span className="ml-1 text-[11px]">按输出秒数与公示「点数」扣减（不足最小时长按最小时长计，详见价格公示）。</span>
          )}
        </li>
        <li>
          <span className="text-foreground/80">Token 类（按调用）：</span>
          {showRetailCoefficient ? (
            <code className="ml-1 text-[11px]">
              in×系数 / 1e6 × 点率 + out×系数 / 1e6 × 点率
            </code>
          ) : (
            <span className="ml-1 text-[11px]">按单次调用与公示「点数」扣减。</span>
          )}
        </li>
        {showRetailCoefficient ? (
          <li>
            <span className="text-foreground/80">零售系数：</span>
            <code className="ml-1 text-[11px]">当前 = 2</code>
            <span className="ml-1">（与价目表「系数」列一致）；调整时仅对生效后的新调用有效。</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
