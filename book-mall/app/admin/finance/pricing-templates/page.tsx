import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listPricingTemplates } from "@/lib/finance/pricing-templates/registry";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "计费模板与公式 — 管理后台",
};

/**
 * 每个 PricingTemplate 的「适用范围 / 公式说明」描述。
 * 注意：实际计算 `compute()` 在各模板实现里；此映射只承担「可读化呈现」。
 * 当新增模板时同时在此处补一行 description（保持 registry.ts 与本页一一对应）。
 */
const TEMPLATE_DESCRIPTIONS: Record<
  string,
  { appliesTo: string; formula: string; example: string; source: string }
> = {
  "aliyun.consumedetail_bill_v2": {
    appliesTo: "阿里云 ConsumeDetailBill V2 CSV 导入（CLOUD_CSV_IMPORT 来源）",
    formula:
      "cost = 应付金额(含税); ourUnit = cost × M(系数); chargedPoints = round(ourUnit × 100)",
    example: "云行 ¥0.20/张 × M=2 → 我方 ¥0.40 → 扣 40 点",
    source: "lib/finance/pricing-templates/aliyun-consumedetail-bill-v2.ts",
  },
  "internal.tool_usage_v1": {
    appliesTo: "工具站使用事件入库（TOOL_USAGE_GENERATED 来源，所有工具默认模板）",
    formula:
      "若有 ToolBillablePrice 命中：cost = schemeAUnitCostYuan; M = schemeAAdminRetailMultiplier; ourUnit = cost × M; points = pricePoints。否则按 1 点最小记账。",
    example:
      "fitting-room__ai-fit/try_on/aitryon · cost ¥0.20 · M=2 → 扣 40 点；记录 cloudRow 携带 cost/M/ourUnit 给财务表显示。",
    source: "lib/finance/pricing-templates/internal-tool-usage-v1.ts",
  },
  "internal.tool_usage_token_v1": {
    appliesTo: "Token 类公式回放（vlab__analysis 等；展示用，未切流为默认）",
    formula:
      "cost = (in_tokens/1e6 × inputYuanPerMillion + out_tokens/1e6 × outputYuanPerMillion); ourUnit = cost × M; points = round(ourUnit × 100)",
    example: "qwen3.6-plus · in 5K + out 1K · cost ≈ 0.022 元 · M=2 → 4 点",
    source: "lib/finance/pricing-templates/internal-tool-usage-formula.ts",
  },
  "internal.tool_usage_seconds_v1": {
    appliesTo: "按秒计价（图生视频；展示用）",
    formula:
      "cost = seconds × perSecondYuan(tier); ourUnit = cost × M; points = round(ourUnit × 100)",
    example:
      "wan2.6-i2v · 5 秒 · 0.6 元/秒 × M=2 → 扣 600 点",
    source: "lib/finance/pricing-templates/internal-tool-usage-formula.ts",
  },
  "internal.tool_usage_image_v1": {
    appliesTo: "按图计价（文生图、试衣 try_on；展示用）",
    formula:
      "cost = images × perImageYuan; ourUnit = cost × M; points = round(ourUnit × 100)",
    example: "wanx2.1-t2i-plus · 1 张 · 0.2 元/张 × M=2 → 扣 40 点",
    source: "lib/finance/pricing-templates/internal-tool-usage-formula.ts",
  },
  "tencent.bill_v1": {
    appliesTo: "腾讯云账单（CLOUD_CSV_IMPORT；预留骨架，待接通）",
    formula: "（与 aliyun.consumedetail_bill_v2 同形：cost = 应付金额 × ...）",
    example: "—（未实装）",
    source: "lib/finance/pricing-templates/tencent-bill-v1.ts",
  },
};

export default async function PricingTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/admin");
  }
  const templates = listPricingTemplates();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-xl font-medium">计费模板与公式</h1>
        <p className="text-sm text-muted-foreground">
          每个 `ToolBillingDetailLine` 都关联一个 `pricingTemplateKey`，决定如何从云行/工具事件计算 cost、系数、我方单价。
          以下是当前注册的所有模板。
        </p>
      </header>

      <div className="grid gap-4">
        {templates.map((t) => {
          const d = TEMPLATE_DESCRIPTIONS[t.id];
          return (
            <section
              key={t.id}
              className="rounded border border-[#e8e8e8] bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex flex-wrap items-baseline gap-3">
                <code className="rounded bg-[#f5f5f5] px-2 py-0.5 text-xs">{t.id}</code>
                <span className="text-base font-medium">{t.label}</span>
              </div>
              <dl className="grid grid-cols-1 gap-2 text-sm md:grid-cols-[120px_1fr]">
                <dt className="text-muted-foreground">适用范围</dt>
                <dd>{d?.appliesTo ?? "—"}</dd>
                <dt className="text-muted-foreground">公式</dt>
                <dd>
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{d?.formula ?? "—"}</pre>
                </dd>
                <dt className="text-muted-foreground">示例</dt>
                <dd>{d?.example ?? "—"}</dd>
                <dt className="text-muted-foreground">代码位置</dt>
                <dd>
                  <code className="text-xs">{d?.source ?? "—"}</code>
                </dd>
              </dl>
            </section>
          );
        })}
      </div>

      <section className="rounded border border-amber-200 bg-amber-50 p-4 text-sm">
        <h2 className="mb-2 font-medium text-amber-900">维护约定</h2>
        <ul className="list-disc space-y-1 pl-5 text-amber-900">
          <li>新增模板需在 `lib/finance/pricing-templates/registry.ts` 的 `BY_ID` 注册，且 `id` 与 `keys.ts` 中常量对齐。</li>
          <li>本页 `TEMPLATE_DESCRIPTIONS` 同时补一行（公式 + 适用范围 + 示例 + 代码路径），否则展示为「—」。</li>
          <li>云厂商接入时优先复用 `aliyun-consumedetail-bill-v2` 的 compute 形态，再实例化新模板（如 `tencent-bill-v1`）。</li>
        </ul>
      </section>
    </div>
  );
}
