"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  X,
  Sparkles,
  Users,
  KeyRound,
  Calculator,
  Minus,
  Plus,
  Film,
  ImageIcon,
  Info,
  Gift,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TEAM_MIN_INCLUDED_SEATS } from "@/lib/billing/team-membership-config";
import { deriveVideoMonthlyCredits } from "@/lib/billing/video-model-seeds";
import {
  computeTeamSeatQuote,
  computeTierGenerations,
  unitLabel,
  type SeatBand,
} from "@/lib/pricing/credit-pricing-formulas";
import { CreditTopupSection } from "@/components/pricing/credit-topup-section";
import { CreditExpiryPolicySection } from "@/components/pricing/credit-expiry-policy";
import { ByokMembershipCta } from "@/components/pricing/byok-subscribe-buttons";
import {
  buildLoginRedirectForCheckout,
  buildMembershipCheckoutPath,
} from "@/lib/payments/checkout-login-redirect";
import type { BillingPersona } from "@prisma/client";

interface SeatTier {
  seatMin: number;
  seatMax: number | null;
  perSeatPriceYuan: number;
  perSeatCredits: number;
}
interface Plan {
  id: string;
  family: string;
  interval: string;
  tier: string;
  sortOrder: number;
  priceYuan: number;
  originalYuan: number | null;
  promoLabel: string | null;
  monthlyCredits: number;
  videoMonthlyCredits: number;
  includedSeats: number;
  seatTiers: SeatTier[];
}
interface ModelPrice {
  canonicalModelKey: string;
  displayName: string;
  unit: string;
  creditsPerUnit: number;
}
interface ByokQuota {
  scopeKey: string;
  taskKind: string;
  label: string;
  monthlyIncluded: number;
  overageCredits: number;
}
interface ResourceRate {
  resourceType: string;
  coefficientYuan: number;
  unitLabel: string;
}

const RESOURCE_LABEL: Record<string, string> = {
  OSS_GB_MONTH: "云存储（OSS）",
  EGRESS_GB: "出网流量",
  TASK_COUNT: "任务调度",
};

// 各档一句话定位
const PERSONAL_DESC = [
  "入门体验，轻量创作够用。",
  "个人高频创作，性价比之选。",
  "专业创作者首选，产能充裕。",
  "重度产出，量大更划算。",
  "顶配产能，畅想无限。",
];
const TEAM_DESC = [
  "专业团队首选，协作高效。",
  "视频团队，量大优惠。",
  "企业级产能与管控。",
  "重度产出，量大更划算。",
  "顶配产能，畅想无限。",
];

/** YouMind 式面板：圆角卡片 + 细边框，无玻璃 blur */
const PANEL_CLASS =
  "rounded-2xl border border-border bg-white";

interface Highlight {
  text: string;
  included: boolean;
  nowrap?: boolean;
}

function resolvePerSeatPools(monthlyCredits: number, videoMonthlyCredits?: number) {
  const perSeatVideo =
    videoMonthlyCredits != null && videoMonthlyCredits > 0
      ? videoMonthlyCredits
      : deriveVideoMonthlyCredits(monthlyCredits);
  const perSeatGeneral = Math.max(0, monthlyCredits - perSeatVideo);
  return { perSeatGeneral, perSeatVideo };
}

/** 构造卡片「套餐亮点」清单（含 ✓/✗ 差异化）。 */
function buildHighlights(args: {
  isTeam: boolean;
  index: number;
  periodLabel: string;
  monthlyCredits: number;
  videoMonthlyCredits: number;
  teamSeats?: number;
  maxImages: number;
  maxVideoSecFromVideoPool: number;
}): Highlight[] {
  const {
    isTeam,
    index,
    periodLabel,
    monthlyCredits,
    videoMonthlyCredits,
    teamSeats = 1,
    maxImages,
    maxVideoSecFromVideoPool,
  } = args;
  const { perSeatGeneral, perSeatVideo } = resolvePerSeatPools(monthlyCredits, videoMonthlyCredits);
  const poolGeneral = isTeam ? perSeatGeneral * teamSeats : perSeatGeneral;
  const poolVideo = isTeam ? perSeatVideo * teamSeats : perSeatVideo;

  if (isTeam) {
    return [
      {
        text: `团队 ${poolGeneral.toLocaleString()} 通用 + ${poolVideo.toLocaleString()} 视频积分/${periodLabel}（${teamSeats} 席）`,
        included: true,
        nowrap: true,
      },
      {
        text: `每席 ${perSeatGeneral.toLocaleString()} 通用 + ${perSeatVideo.toLocaleString()} 视频（视频仅扣视频池）`,
        included: true,
        nowrap: true,
      },
      {
        text: `最多约 ${maxImages.toLocaleString()} 张图/${periodLabel}（每席·通用池）`,
        included: true,
        nowrap: true,
      },
      {
        text: `最多约 ${maxVideoSecFromVideoPool.toLocaleString()} 秒视频/${periodLabel}（每席·视频池）`,
        included: true,
        nowrap: true,
      },
      { text: "团队共享资产库 · 多人画布协作", included: true },
      { text: "席位 / 权限 / 用量管控", included: true },
      { text: "用量报表 · 成员消耗下钻", included: index >= 0 },
      { text: "会员加速 · 高并发任务", included: index >= 1 },
      { text: "优先支持 · 专属客户成功", included: index >= 2 },
    ];
  }

  return [
    {
      text: `每月 ${poolGeneral.toLocaleString()} 通用 + ${poolVideo.toLocaleString()} 视频积分`,
      included: true,
    },
    {
      text: "视频仅扣视频池，图文扣通用池，两池不互通",
      included: true,
    },
    {
      text: `最多约 ${maxImages.toLocaleString()} 张图（通用池）/ ${maxVideoSecFromVideoPool.toLocaleString()} 秒视频（视频池）`,
      included: true,
    },
    { text: "全站应用通用：工具站 / Canvas / Story / 电商 / 提示词", included: true },
    { text: "失败 / 取消自动返还", included: true },
    { text: "去除品牌水印 · 商用授权", included: index >= 1 },
    { text: "会员专享加速 · 高并发", included: index >= 2 },
    { text: "优先排队 · 新功能内测", included: index >= 3 },
    { text: "专属权益 · 每日登录赠积分", included: index >= 4 },
  ];
}

export function PricingPageClient({
  anchorYuan,
  plans,
  models,
  byokQuotas = [],
  rates,
  teamTenants = [],
  isLoggedIn,
  billingPersona = null,
  welcomeGift,
}: {
  anchorYuan: number;
  plans: Plan[];
  models: ModelPrice[];
  byokQuotas?: ByokQuota[];
  rates: ResourceRate[];
  teamTenants?: { id: string; name: string }[];
  isLoggedIn: boolean;
  billingPersona?: BillingPersona | null;
  welcomeGift?: { generalCredits: number; videoCredits: number } | null;
}) {
  const [family, setFamily] = useState<"PERSONAL" | "TEAM">("PERSONAL");
  const [interval, setInterval] = useState<"MONTH" | "YEAR">("MONTH");
  const searchParams = useSearchParams();
  const checkoutError = searchParams.get("error");

  const checkoutErrorMessage =
    checkoutError === "byok-persona"
      ? "当前账号为自带 Key（BYOK）身份，无法购买平台代付会员套餐。积分清零不影响此限制——计费身份在注册时已锁定。请使用 BYOK 入口，或由财务后台为您续充。"
      : checkoutError === "persona"
        ? "请先完成计费身份选择后再开通会员。"
        : checkoutError === "no-plan"
          ? "未选择有效套餐，请从下方卡片重新点击「立即开通」。"
          : checkoutError === "invalid-plan"
            ? "所选套餐已下架或不存在，请刷新页面后重试。"
            : null;

  useEffect(() => {
    if (!checkoutError) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [checkoutError]);

  const visible = useMemo(
    () =>
      plans
        .filter((p) => p.family === family && p.interval === interval)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [plans, family, interval],
  );

  const isTeam = family === "TEAM";
  const periodLabel = interval === "YEAR" ? "年" : "月";

  // 视频 / 图片分组（生成矩阵分区）
  const videoModels = models.filter((m) => m.unit === "PER_SEC");
  const imageModels = models.filter((m) => m.unit === "PER_IMAGE");
  const otherModels = models.filter((m) => m.unit !== "PER_SEC" && m.unit !== "PER_IMAGE");

  // 各档「最便宜」单价，用于「最多生成约 …」估算
  const minImageCpu = imageModels.length > 0 ? Math.min(...imageModels.map((m) => m.creditsPerUnit)) : 0;
  const minVideoCpu = videoModels.length > 0 ? Math.min(...videoModels.map((m) => m.creditsPerUnit)) : 0;

  // 同档年付价（用于「买年卡立省 X%」）
  const yearPriceByTier = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of plans) {
      if (p.family === family && p.interval === "YEAR") map.set(p.tier, p.priceYuan);
    }
    return map;
  }, [plans, family]);

  return (
    <div className="site-pricing-page">
      <div className="site-pricing-hero">
        <h1 className="site-pricing-title">专业 AI 工具 · 积分会员</h1>
        <p className="site-pricing-subtitle">
          透明积分体系：按月订阅发放积分，全站 AI 应用通用；自带 Key 用户厂商费用自理，超额从轻量包扣点。
        </p>

        {welcomeGift &&
        (welcomeGift.generalCredits > 0 || welcomeGift.videoCredits > 0) ? (
          <div className="mx-auto mt-5 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-[#8957e5]/30 bg-[#8957e5]/10 px-4 py-2 text-sm text-[#5a32a3]">
            <Gift className="h-4 w-4" />
            <span>
              新用户注册即送 {welcomeGift.generalCredits.toLocaleString()} 通用积分
              {welcomeGift.videoCredits > 0
                ? ` + ${welcomeGift.videoCredits.toLocaleString()} 视频积分`
                : ""}
              ，30 天内有效
            </span>
          </div>
        ) : null}

        {checkoutErrorMessage ? (
          <div
            id="checkout-error-banner"
            className="mx-auto mt-5 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            {checkoutErrorMessage}
            {checkoutError === "persona" ? (
              <>
                {" "}
                <Link href="/onboarding/billing-persona" className="font-medium underline">
                  去选择计费身份
                </Link>
              </>
            ) : null}
            {checkoutError === "byok-persona" ? (
              <>
                {" "}
                <Link href="/account/billing" className="font-medium underline">
                  查看账户计费
                </Link>
              </>
            ) : null}
          </div>
        ) : null}

        {isLoggedIn && billingPersona === "BYOK" && !checkoutErrorMessage ? (
          <div className="mx-auto mt-5 max-w-2xl rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            您当前为 <strong>自带 Key（BYOK）</strong> 身份，报价页「立即开通」仅适用于
            <strong>平台代付</strong> 会员。积分清零不会解除此限制。如需续充 VIP 大额预充，请联系商务或在
            <Link href="/account/team" className="font-medium underline">
              团队中心
            </Link>
            查看现有团队。
          </div>
        ) : null}

        <div className="site-pricing-toggles">
          <div className="site-pricing-toggle-group">
            <ToggleBtn active={family === "PERSONAL"} onClick={() => setFamily("PERSONAL")}>
              <Sparkles className="mr-1.5 h-4 w-4" /> 个人创作
            </ToggleBtn>
            <ToggleBtn active={family === "TEAM"} onClick={() => setFamily("TEAM")}>
              <Users className="mr-1.5 h-4 w-4" /> 团队 / 公司
            </ToggleBtn>
          </div>
          <div className="site-pricing-toggle-group text-sm">
            <ToggleBtn small active={interval === "MONTH"} onClick={() => setInterval("MONTH")}>
              按月
            </ToggleBtn>
            <ToggleBtn small active={interval === "YEAR"} onClick={() => setInterval("YEAR")}>
              按年
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                省2个月
              </span>
            </ToggleBtn>
          </div>
        </div>
      </div>

      <div className="site-pricing-disclosure">
        <p>
          下方{visible.length}档为平台代付（积分套餐）：月发积分拆为通用池（图文 / 文本等）与视频池（仅视频生成），两池不互通、按模型扣积分。
          {isTeam
            ? " 团队套餐 3 席起订，大卡价格为套餐合计（非单席价），下方标注每席单价。"
            : null}
        </p>
        <p>
          若注册时选择自带 Key（BYOK），请见本页下方说明——不含月度积分，含任务次数额度；超额与工具月费从轻量包余额扣。
        </p>
      </div>

      <div
        className={cn(
          "site-pricing-plans-grid mt-8",
          isTeam ? "site-pricing-plans-grid--team" : "site-pricing-plans-grid--personal",
        )}
      >
          {visible.map((p, i) => {
            const yearPrice = yearPriceByTier.get(p.tier);
            const annualSavingPct =
              interval === "MONTH" && yearPrice && p.priceYuan > 0
                ? Math.round((1 - yearPrice / (p.priceYuan * 12)) * 100)
                : null;
            return (
              <PlanCard
                key={p.id}
                plan={p}
                index={i}
                isTeam={isTeam}
                isLoggedIn={isLoggedIn}
                billingPersona={billingPersona}
                interval={interval}
                periodLabel={periodLabel}
                anchorYuan={anchorYuan}
                featured={isTeam ? i === 1 : i === Math.min(2, visible.length - 1)}
                minImageCpu={minImageCpu}
                minVideoCpu={minVideoCpu}
                annualSavingPct={annualSavingPct}
              />
            );
          })}
          {visible.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
              该组合套餐即将上线
            </div>
          ) : null}
      </div>

      <div className="site-pricing-body">
        {isTeam ? (
          <div className="mt-8 flex justify-center">
            <Link
              href="/account/team"
              className="site-pricing-toggle inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-5 py-2.5 text-foreground transition hover:bg-muted"
            >
              <Users className="h-4 w-4" />
              团队管理入口 — 成员 / 席位 / 权限
            </Link>
          </div>
        ) : null}

        {/* 全档「可生成数量」矩阵 */}
        {models.length > 0 && visible.length > 0 ? (
          <section className="mt-16">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="site-pricing-section-title">
                每月可生成数量{isTeam ? " / 每席位" : ""}
              </h2>
              <p className="site-pricing-footnote">
                *数字为「只用该模型」的估算上限；通用池与视频池互不挪用，混用各自扣到 0 为止。
              </p>
            </div>
            <div className={cn("mt-4 overflow-x-auto", PANEL_CLASS)}>
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/30 hover:bg-muted/30">
                    <TableHead className="min-w-[160px] text-foreground">模型</TableHead>
                    <TableHead className="whitespace-nowrap text-right text-foreground">每次消耗</TableHead>
                    {visible.map((p) => {
                      const { perSeatGeneral, perSeatVideo } = resolvePerSeatPools(
                        p.monthlyCredits,
                        p.videoMonthlyCredits,
                      );
                      return (
                        <TableHead key={p.id} className="min-w-[7.5rem] text-right text-foreground">
                          {p.tier}
                          <span className="mt-0.5 block text-[10px] font-normal leading-tight text-muted-foreground">
                            通用 {perSeatGeneral.toLocaleString()} / 视频 {perSeatVideo.toLocaleString()}
                          </span>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <GroupRow icon={<Film className="h-3.5 w-3.5" />} label="视频模型（含参数）" span={visible.length + 2} />
                  {videoModels.map((m) => (
                    <ModelMatrixRow key={m.canonicalModelKey} model={m} tiers={visible} />
                  ))}
                  <GroupRow icon={<ImageIcon className="h-3.5 w-3.5" />} label="图片模型（含参数）" span={visible.length + 2} />
                  {imageModels.map((m) => (
                    <ModelMatrixRow key={m.canonicalModelKey} model={m} tiers={visible} />
                  ))}
                  {otherModels.length > 0 ? (
                    <>
                      <GroupRow icon={<Sparkles className="h-3.5 w-3.5" />} label="其他模型" span={visible.length + 2} />
                      {otherModels.map((m) => (
                        <ModelMatrixRow key={m.canonicalModelKey} model={m} tiers={visible} />
                      ))}
                    </>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            <p className="mt-2 site-pricing-footnote">
              生成次数为单一模型的估算值（实际因参数而异）。视频行按视频池、图片行按通用池。
              {isTeam ? " 团队为「每席位」口径，团队池 = 每席 × 席数。" : ""}
            </p>
          </section>
        ) : null}

        <CreditTopupSection
          anchorYuan={anchorYuan}
          isTeam={isTeam}
          teamTenants={teamTenants}
          isLoggedIn={isLoggedIn}
        />

        {/* 规则说明 + 用完处理 */}
        <section className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className={cn(PANEL_CLASS, "p-6")}>
            <div className="site-pricing-panel-title flex items-center gap-2">
              <Info className="h-5 w-5 text-muted-foreground" /> 计费规则（一看就懂）
            </div>
            <ul className="mt-3 space-y-2 site-pricing-body-text">
              <li>
                双积分池：通用池（图文 / 文本等）与视频池（仅视频）分开发放、分开扣减，不可互借。
              </li>
              <li>视频池约占每席月积分的 20%（财务 2.0 默认）；通用池为其余部分。</li>
              <li>每次生成按该模型「积分/次」从对应池扣；不是每个模型各有配额。</li>
              <li>上表「X 张 / X 秒」是只用该模型的上限，同池内互斥——做图就少了做视频的额度。</li>
              <li>失败 / 取消全额返还积分。</li>
              <li>
                会员服务：月付自购买起 <strong className="text-foreground">31 天</strong>、年付{" "}
                <strong className="text-foreground">365 天</strong>（点到点，非自然月/年）；期内订阅积分每{" "}
                <strong className="text-foreground">31 天</strong> 清零刷新。
              </li>
              <li>
                其它积分：充值 12 个月、注册/活动赠送 30 天；扣费优先用最先到期的积分。详见
                <Link href="/pricing-disclosure#credit-expiry" className="ml-1 text-foreground underline">
                  积分清零规则
                </Link>
                。
              </li>
            </ul>
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 site-pricing-body-text">
              <div className="site-pricing-panel-title">积分用完了怎么办？</div>
              <ul className="mt-1 space-y-1">
                <li>① 暂停生成，待下一积分周期（31 天）自动重置发放，或续费延长会员服务；</li>
                <li>② 随时购买积分加油包（含视频专项包），即时到账（团队进共享池）；</li>
                <li>③ 升级更高档，立即补足差额积分。</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <div className={cn(PANEL_CLASS, "p-6")}>
              <div className="site-pricing-panel-title flex items-center gap-2">
                <Calculator className="h-5 w-5 text-muted-foreground" /> 透明计价公式
              </div>
              <ul className="mt-3 space-y-2 site-pricing-body-text">
                <li>1 积分 ≈ ¥{anchorYuan} 挂牌价值</li>
                <li>
                  每次消耗 = <code className="rounded bg-muted px-1 text-foreground">round(模型挂牌价 ÷ {anchorYuan})</code>
                </li>
                <li>
                  可生成数量 = <code className="rounded bg-muted px-1 text-foreground">套餐积分 ÷ 每次消耗</code>
                </li>
              </ul>
            </div>

            <div className={cn(PANEL_CLASS, "p-6")}>
              <div className="site-pricing-panel-title flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-muted-foreground" /> 自带 Key（BYOK）
              </div>
              <p className="mt-2 site-pricing-body-text">
                已有厂商 API Key？绑定后模型费用由你与厂商直接结算，平台不扣推理积分。须先开通会员订阅获得工具准入；套餐内含月度任务次数，超出后购买轻量包按次扣积分。
              </p>
              <div className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 site-pricing-body-text-sm">
                <p className="site-pricing-panel-title">BYOK 怎么扣费？</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  <li>会员订阅：工具准入（与平台代付共用套餐体系）</li>
                  <li>套餐内：文生图（含试衣）、图生视频、视频生视频、视频理解、TTS 按次数免费</li>
                  <li>超额：从轻量包通用积分池按次扣分</li>
                  <li>厂商费：走你的 Gateway Key，Book 不代收</li>
                </ul>
              </div>
              {byokQuotas.length > 0 ? (
                <ul className="mt-3 space-y-1 site-pricing-footnote">
                  {byokQuotas
                    .filter((q) => q.scopeKey === "personal")
                    .map((q) => (
                      <li key={q.taskKind}>
                        {q.label}：含 {q.monthlyIncluded} 次/月，超额 {q.overageCredits} 积分/次
                      </li>
                    ))}
                </ul>
              ) : null}
              <ByokMembershipCta isLoggedIn={isLoggedIn} />
              {byokQuotas.some((q) => q.scopeKey === "team-seat") ? (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="site-pricing-panel-title">团队 BYOK</p>
                  <ul className="mt-1 space-y-0.5 site-pricing-footnote">
                    {byokQuotas
                      .filter((q) => q.scopeKey === "team-seat")
                      .map((q) => (
                        <li key={q.taskKind}>
                          {q.label}：含 {q.monthlyIncluded} 次/月/席，超额 {q.overageCredits} 积分/次
                        </li>
                      ))}
                  </ul>
                  <ByokMembershipCta isLoggedIn={isLoggedIn} isTeamScope />
                </div>
              ) : null}
              {rates.length > 0 ? (
                <div className="mt-3 border-t border-border pt-3 site-pricing-footnote">
                  资源使用费：
                  {rates.map((r) => (
                    <span key={r.resourceType} className="mr-2">
                      {RESOURCE_LABEL[r.resourceType] ?? r.resourceType} ¥{r.coefficientYuan}/{r.unitLabel}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <CreditExpiryPolicySection embedded />

        <p className="mt-10 text-center site-pricing-footnote">
          AI 课程不在积分体系内，单独购买、不受积分限制。最终解释权与计费明细见
          <Link href="/pricing-disclosure" className="ml-1 text-foreground underline">
            价格公示
          </Link>
          。
        </p>
      </div>
    </div>
  );
}

/* ============================ 套餐卡片 ============================ */

function PlanCard({
  plan,
  index,
  isTeam,
  isLoggedIn,
  billingPersona,
  interval,
  periodLabel,
  anchorYuan,
  featured,
  minImageCpu,
  minVideoCpu,
  annualSavingPct,
}: {
  plan: Plan;
  index: number;
  isTeam: boolean;
  isLoggedIn: boolean;
  billingPersona: BillingPersona | null;
  interval: string;
  periodLabel: string;
  anchorYuan: number;
  featured: boolean;
  minImageCpu: number;
  minVideoCpu: number;
  annualSavingPct: number | null;
}) {
  const router = useRouter();
  const [seats, setSeats] = useState<number>(
    Math.max(TEAM_MIN_INCLUDED_SEATS, plan.includedSeats),
  );

  const bands: SeatBand[] = plan.seatTiers.map((t) => ({
    seatMin: t.seatMin,
    seatMax: t.seatMax,
    perSeatPriceYuan: t.perSeatPriceYuan,
    perSeatCredits: t.perSeatCredits,
  }));

  const minSeats = Math.max(TEAM_MIN_INCLUDED_SEATS, plan.includedSeats);
  const quote = computeTeamSeatQuote({
    bands,
    minSeats,
    fallbackPerSeatPriceYuan: minSeats > 0 ? plan.priceYuan / minSeats : plan.priceYuan,
    fallbackPerSeatCredits: plan.monthlyCredits,
    seats,
  });

  const headlinePrice = isTeam ? quote.totalPriceYuan : plan.priceYuan;
  const teamOriginalTotal =
    isTeam && plan.originalYuan
      ? Math.round((plan.originalYuan / minSeats) * quote.seats)
      : plan.originalYuan;
  // 用于「最多生成约 …」与「1积分≈¥X」的积分口径（团队按每席）
  const basisCredits = isTeam ? quote.perSeatCredits : plan.monthlyCredits;
  const yuanPerCredit =
    basisCredits > 0 ? Math.round((headlinePrice / basisCredits) * 1000) / 1000 : anchorYuan;
  const { perSeatGeneral, perSeatVideo } = resolvePerSeatPools(
    plan.monthlyCredits,
    plan.videoMonthlyCredits,
  );
  const maxImages = minImageCpu > 0 ? Math.floor(perSeatGeneral / minImageCpu) : 0;
  const maxVideoSecFromVideoPool =
    minVideoCpu > 0 ? Math.floor(perSeatVideo / minVideoCpu) : 0;

  const desc = (isTeam ? TEAM_DESC : PERSONAL_DESC)[index] ?? "";
  const highlights = buildHighlights({
    isTeam,
    index,
    periodLabel,
    monthlyCredits: plan.monthlyCredits,
    videoMonthlyCredits: plan.videoMonthlyCredits,
    teamSeats: isTeam ? quote.seats : undefined,
    maxImages,
    maxVideoSecFromVideoPool,
  });

  function goCheckout() {
    if (isLoggedIn && billingPersona === "BYOK") {
      window.location.assign("/pricing?error=byok-persona");
      return;
    }
    const checkoutPath = buildMembershipCheckoutPath({
      planId: plan.id,
      seats: isTeam ? quote.seats : undefined,
    });
    if (!isLoggedIn) {
      router.push(buildLoginRedirectForCheckout(checkoutPath));
      return;
    }
    window.location.assign(checkoutPath);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        "site-pricing-plan-card relative flex w-full min-w-0 flex-col overflow-visible rounded-2xl border border-border bg-white transition-colors duration-300",
        featured && "z-10 ring-1 ring-black/5",
      )}
    >
      {/* 顶部药丸徽标：骑在顶边线上，文字中线对齐边框（见图 2） */}
      {featured || plan.promoLabel ? (
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="site-pricing-plan-badge whitespace-nowrap rounded-full border border-border bg-white px-4 py-1.5 text-foreground">
            {plan.promoLabel ?? "最受欢迎"}
          </div>
        </div>
      ) : null}

      {/* ===== 头部：档名 / 价格 / 描述 ===== */}
      <div className="px-6 pb-6 pt-10 text-center">
        <div className="mb-3 site-pricing-plan-tier">
          {isTeam ? "团队 · " : "个人 · "}
          {plan.tier}
        </div>
        <div className="site-pricing-plan-price-row">
          <span className="site-pricing-plan-currency">¥</span>
          <span className="site-pricing-plan-price">{headlinePrice}</span>
          <span className="site-pricing-plan-period">/{periodLabel}</span>
        </div>
        {isTeam ? (
          <p className="mt-2 site-pricing-plan-meta">
            套餐价 · 每席 ¥{quote.perSeatPriceYuan}
            <span className="mx-1 text-border">·</span>
            {quote.seats} 席
            {quote.seats === minSeats ? (
              <span className="text-xs">（{minSeats} 席起订）</span>
            ) : null}
          </p>
        ) : null}
        <div className="mt-2 flex flex-nowrap items-center justify-center gap-2 site-pricing-plan-meta site-pricing-plan-meta-row">
          {teamOriginalTotal ? (
            <span className="shrink-0 line-through">¥{teamOriginalTotal}</span>
          ) : null}
          {!isTeam && plan.originalYuan ? (
            <span className="shrink-0 line-through">¥{plan.originalYuan}</span>
          ) : null}
          <span className="shrink-0">1积分≈¥{yuanPerCredit}</span>
          {annualSavingPct && annualSavingPct > 0 ? (
            <span className="shrink-0">年付省{annualSavingPct}%</span>
          ) : null}
        </div>
        <p className="mt-4 site-pricing-plan-desc">{desc}</p>

        {/* 团队席位计数器 */}
        {isTeam ? (
          <div className="site-pricing-plan-seat-box mt-5 rounded-xl border border-border/60 bg-white px-3 py-2.5">
            <p className="mb-2 text-center site-pricing-plan-meta">调整席位数（套餐价随席数变化）</p>
            <div className="flex items-center justify-center gap-3">
              <div className="inline-flex shrink-0 items-center rounded-lg border border-border/70 bg-background">
                <button
                  type="button"
                  aria-label="减少席位"
                  onClick={() => setSeats((s) => Math.max(minSeats, s - 1))}
                  disabled={seats <= minSeats}
                  className="flex h-7 w-7 items-center justify-center rounded-l-lg text-foreground/70 transition hover:bg-muted disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[2.5rem] text-center text-sm text-foreground">
                  {quote.seats} 席
                </span>
                <button
                  type="button"
                  aria-label="增加席位"
                  onClick={() => setSeats((s) => Math.min(999, s + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-r-lg text-foreground/70 transition hover:bg-muted"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ===== 套餐亮点 ===== */}
      <div className="px-6">
        <h4 className="site-pricing-highlights-label mb-5">套餐亮点</h4>
        <div className="space-y-3.5">
          {highlights.map((f) => (
            <div key={f.text} className="flex items-start gap-3">
              {f.included ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500 dark:text-green-400" />
              ) : (
                <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-400/70" />
              )}
              <span
                className={cn(
                  "site-pricing-highlight-text",
                  f.nowrap && "site-pricing-highlight-nowrap",
                  !f.included && "text-muted-foreground line-through",
                )}
              >
                {f.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== 按钮 / footer ===== */}
      <div className="mt-auto px-6 pb-8 pt-6">
        <Button
          type="button"
          variant={featured ? "default" : "outline"}
          className="h-11 w-full rounded-full text-sm font-medium"
          onClick={goCheckout}
          disabled={isLoggedIn && billingPersona === "BYOK"}
        >
          {isLoggedIn && billingPersona === "BYOK"
            ? "BYOK 账号不可购"
            : isTeam
              ? "开通团队会员"
              : "立即开通"}
        </Button>
      </div>
    </motion.div>
  );
}

/* ============================ 生成矩阵行 ============================ */

function GroupRow({ icon, label, span }: { icon: React.ReactNode; label: string; span: number }) {
  return (
    <TableRow className="border-border bg-muted/20 hover:bg-muted/20">
      <TableCell colSpan={span} className="py-1.5 site-pricing-footnote font-medium">
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {label}
        </span>
      </TableCell>
    </TableRow>
  );
}

function ModelMatrixRow({ model, tiers }: { model: ModelPrice; tiers: Plan[] }) {
  const isVideo = model.unit === "PER_SEC";
  return (
    <TableRow className="border-border">
      <TableCell className="font-medium text-foreground">{model.displayName}</TableCell>
      <TableCell className="whitespace-nowrap text-right text-muted-foreground">
        {model.creditsPerUnit} 积分 / {unitLabel(model.unit)}
      </TableCell>
      {tiers.map((p) => {
        const { perSeatGeneral, perSeatVideo } = resolvePerSeatPools(
          p.monthlyCredits,
          p.videoMonthlyCredits,
        );
        const poolCredits = isVideo ? perSeatVideo : perSeatGeneral;
        return (
          <TableCell key={p.id} className="whitespace-nowrap text-right text-foreground">
            {computeTierGenerations(poolCredits, model.creditsPerUnit).toLocaleString()}
            <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unitLabel(model.unit)}</span>
          </TableCell>
        );
      })}
    </TableRow>
  );
}

function ToggleBtn({
  active,
  small,
  onClick,
  children,
}: {
  active: boolean;
  small?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "site-pricing-toggle inline-flex items-center rounded-full transition",
        small ? "px-4 py-1.5" : "px-5 py-2",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
