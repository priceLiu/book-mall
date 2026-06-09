"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import {
  computeTeamSeatQuote,
  computeTierGenerations,
  unitLabel,
  type SeatBand,
} from "@/lib/pricing/credit-pricing-formulas";
import { CreditTopupSection } from "@/components/pricing/credit-topup-section";

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
  includedSeats: number;
  seatTiers: SeatTier[];
}
interface ModelPrice {
  canonicalModelKey: string;
  displayName: string;
  unit: string;
  creditsPerUnit: number;
}
interface ByokConfig {
  scopeKey: string;
  label: string;
  techServiceFeeYuan: number;
  interval: string;
  minSeats: number | null;
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
  "小团队起步协作。",
  "成长团队高频产出。",
  "专业团队首选，协作高效。",
  "规模团队，量大优惠。",
  "企业级产能与管控。",
];

/** 与套餐卡片统一的玻璃面板样式 */
const PANEL_CLASS =
  "rounded-3xl border border-sky-200/70 bg-white/70 dark:border-slate-700/60 dark:bg-slate-900/50";

interface Highlight {
  text: string;
  included: boolean;
  hasInfo?: boolean;
}

/** 构造卡片「套餐亮点」清单（含 ✓/✗ 差异化）。 */
function buildHighlights(args: {
  isTeam: boolean;
  index: number;
  periodLabel: string;
  monthlyCredits: number;
  poolCredits: number;
  maxImages: number;
  maxVideoSec: number;
}): Highlight[] {
  const { isTeam, index, periodLabel, monthlyCredits, poolCredits, maxImages, maxVideoSec } = args;
  const gen = `最多约 ${maxImages.toLocaleString()} 张图 / ${maxVideoSec.toLocaleString()} 秒视频`;
  if (isTeam) {
    return [
      { text: `团队共 ${poolCredits.toLocaleString()} 积分/${periodLabel}（每席 ${monthlyCredits.toLocaleString()}）`, included: true, hasInfo: true },
      { text: `${gen}（每席）`, included: true, hasInfo: true },
      { text: "团队共享资产库 · 多人画布协作", included: true },
      { text: "席位 / 权限 / 用量管控", included: true },
      { text: "用量报表 · 成员消耗下钻", included: index >= 1 },
      { text: "会员加速 · 高并发任务", included: index >= 2 },
      { text: "优先支持 · 专属客户成功", included: index >= 3, hasInfo: true },
    ];
  }
  return [
    { text: `每月 ${monthlyCredits.toLocaleString()} 积分`, included: true },
    { text: gen, included: true, hasInfo: true },
    { text: "全站应用通用：工具站 / Canvas / Story / 电商 / 提示词", included: true, hasInfo: true },
    { text: "失败 / 取消自动返还", included: true },
    { text: "去除品牌水印 · 商用授权", included: index >= 1 },
    { text: "会员专享加速 · 高并发", included: index >= 2 },
    { text: "优先排队 · 新功能内测", included: index >= 3 },
    { text: "专属权益 · 每日登录赠积分", included: index >= 4, hasInfo: true },
  ];
}

export function PricingPageClient({
  anchorYuan,
  plans,
  models,
  byok,
  byokQuotas = [],
  rates,
  isLoggedIn,
  teamTenants,
}: {
  anchorYuan: number;
  plans: Plan[];
  models: ModelPrice[];
  byok: ByokConfig[];
  byokQuotas?: ByokQuota[];
  rates: ResourceRate[];
  isLoggedIn: boolean;
  teamTenants: { id: string; name: string }[];
}) {
  const [family, setFamily] = useState<"PERSONAL" | "TEAM">("PERSONAL");
  const [interval, setInterval] = useState<"MONTH" | "YEAR">("MONTH");

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
    <div className="relative min-h-screen bg-gradient-to-b from-sky-50/80 via-white to-sky-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="relative mx-auto w-full max-w-[1928px] px-4 py-12 sm:py-16">
        {/* 蓝金光晕 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 select-none">
          <div className="absolute left-1/4 top-10 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="absolute right-1/4 top-0 h-64 w-64 rounded-full bg-amber-300/25 blur-3xl" />
        </div>

        <div className="text-center">
          <h1 className="bg-gradient-to-r from-sky-500 via-blue-500 to-amber-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            专业 AI 工具 · 积分会员
          </h1>
        </div>

        {/* 切换：个人/团队 + 月/年（玻璃风，与卡片统一） */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <div
            className={cn("inline-flex rounded-full p-1", PANEL_CLASS)}
            style={{ backdropFilter: "blur(10px)" }}
          >
            <ToggleBtn active={family === "PERSONAL"} onClick={() => setFamily("PERSONAL")}>
              <Sparkles className="mr-1 h-4 w-4" /> 个人创作
            </ToggleBtn>
            <ToggleBtn active={family === "TEAM"} onClick={() => setFamily("TEAM")}>
              <Users className="mr-1 h-4 w-4" /> 团队 / 公司
            </ToggleBtn>
          </div>
          <div
            className={cn("inline-flex rounded-full p-1 text-sm", PANEL_CLASS)}
            style={{ backdropFilter: "blur(10px)" }}
          >
            <ToggleBtn small active={interval === "MONTH"} onClick={() => setInterval("MONTH")}>
              按月
            </ToggleBtn>
            <ToggleBtn small active={interval === "YEAR"} onClick={() => setInterval("YEAR")}>
              按年
              <span className="ml-1 rounded bg-amber-400/20 px-1 text-xs text-amber-600 dark:text-amber-400">
                省2个月
              </span>
            </ToggleBtn>
          </div>
        </div>

        {/* 套餐卡片：一行五张；外层 overflow-visible 给顶边徽标留空间 */}
        <div className="mt-10 overflow-visible">
          <div className="flex flex-nowrap items-start justify-center gap-6 overflow-x-auto px-2 pb-2 pt-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                interval={interval}
                periodLabel={periodLabel}
                anchorYuan={anchorYuan}
                featured={i === Math.min(2, visible.length - 1)}
                minImageCpu={minImageCpu}
                minVideoCpu={minVideoCpu}
                annualSavingPct={annualSavingPct}
              />
            );
          })}
          {visible.length === 0 ? (
            <div className="w-full rounded-xl border border-dashed py-12 text-center text-muted-foreground">
              该组合套餐即将上线
            </div>
          ) : null}
          </div>
        </div>

        {isTeam ? (
          <div className="mt-6 flex justify-center">
            <Link
              href="/account/team"
              className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-700 transition hover:bg-amber-500/20 dark:text-amber-300"
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
              <h2 className="text-xl font-semibold text-foreground">
                每月可生成数量{isTeam ? " / 每席位" : ""}
              </h2>
              <p className="text-xs text-muted-foreground">
                *数字为「只用该模型」的估算上限；同一积分池<b className="text-amber-600 dark:text-amber-400">互斥非叠加</b>，混用扣到 0 为止。
              </p>
            </div>
            <div
              className={cn(
                "mt-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                PANEL_CLASS,
              )}
              style={{ backdropFilter: "blur(10px)" }}
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-sky-200/50 bg-sky-50/50 hover:bg-sky-50/50 dark:border-slate-700/50 dark:bg-slate-800/40">
                    <TableHead className="min-w-[160px] text-foreground">模型</TableHead>
                    <TableHead className="whitespace-nowrap text-right text-foreground">每次消耗</TableHead>
                    {visible.map((p) => (
                      <TableHead key={p.id} className="whitespace-nowrap text-right text-foreground">
                        {p.tier}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          {p.monthlyCredits.toLocaleString()}
                        </span>
                      </TableHead>
                    ))}
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
            <p className="mt-2 text-xs text-muted-foreground">
              生成次数为单一模型的估算值（实际因参数而异）。{isTeam ? "团队为「每席位」口径，团队池 = 每席 × 席数。" : ""}
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
          <div className={cn(PANEL_CLASS, "p-6")} style={{ backdropFilter: "blur(10px)" }}>
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Info className="h-5 w-5 text-amber-500" /> 计费规则（一看就懂）
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <b className="text-foreground">一个共享积分池</b>：月费买「每月 N 积分」，全站 AI 应用通用。
              </li>
              <li>
                每次生成按该模型「积分/次」从同一池扣；<b className="text-foreground">不是每个模型各有配额</b>。
              </li>
              <li>
                上表「X 张 / X 秒」是<b className="text-foreground">只用该模型</b>的上限，互斥——做图就少了做视频的额度。
              </li>
              <li>失败 / 取消<b className="text-foreground">全额返还</b>积分。</li>
            </ul>
            <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-500/10 p-3 text-sm">
              <div className="font-semibold text-amber-600 dark:text-amber-400">积分用完了怎么办？</div>
              <ul className="mt-1 space-y-1 text-muted-foreground">
                <li>① 暂停生成，下个账期自动重置发放；</li>
                <li>② 随时购买<b>积分加油包</b>，即时到账（团队进共享池）；</li>
                <li>③ 升级更高档，立即补足差额积分。</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <div className={cn(PANEL_CLASS, "p-6")} style={{ backdropFilter: "blur(10px)" }}>
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Calculator className="h-5 w-5 text-amber-500" /> 透明计价公式
              </div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  1 积分 ≈ <b className="text-foreground">¥{anchorYuan}</b> 挂牌价值
                </li>
                <li>
                  每次消耗 = <code className="rounded bg-muted px-1 text-foreground">round(模型挂牌价 ÷ {anchorYuan})</code>
                </li>
                <li>
                  可生成数量 = <code className="rounded bg-muted px-1 text-foreground">套餐积分 ÷ 每次消耗</code>
                </li>
              </ul>
            </div>

            <div
              className={cn(PANEL_CLASS, "border-amber-300/50 p-6")}
              style={{ backdropFilter: "blur(10px)" }}
            >
              <div className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
                <KeyRound className="h-5 w-5" /> 自带 Key（BYOK）
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                已有厂商 API Key？绑定后模型费用由你与厂商直接结算，平台
                <b className="text-foreground">不扣积分、不赚差价</b>，仅收技术服务费；套餐内含月度任务额度，超出后购买轻量包按次扣积分。
              </p>
              {byok.length > 0 ? (
                <div className="mt-3 space-y-3 text-sm">
                  {byok.map((b) => (
                    <div key={b.scopeKey} className="rounded-lg border border-amber-300/40 p-3">
                      <div className="flex justify-between font-semibold">
                        <span>{b.label}</span>
                        <span>
                          ¥{b.techServiceFeeYuan}/{b.interval === "YEAR" ? "年" : "月"}
                          {b.scopeKey === "team-seat" && b.minSeats ? ` / 席（${b.minSeats} 席起）` : ""}
                        </span>
                      </div>
                      {byokQuotas.filter((q) => q.scopeKey === b.scopeKey).length > 0 ? (
                        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                          {byokQuotas
                            .filter((q) => q.scopeKey === b.scopeKey)
                            .map((q) => (
                              <li key={q.taskKind}>
                                {q.label}：含 {q.monthlyIncluded} 次/月
                                {b.scopeKey === "team-seat" ? "/席" : ""}，超额 {q.overageCredits} 积分/次
                              </li>
                            ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {rates.length > 0 ? (
                <div className="mt-3 border-t border-amber-300/30 pt-3 text-xs text-muted-foreground">
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

        <p className="mt-10 text-center text-xs text-muted-foreground">
          AI 课程不在积分体系内，单独购买、不受积分限制。最终解释权与计费明细见
          <Link href="/pricing-disclosure" className="ml-1 text-amber-600 underline dark:text-amber-400">
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
  interval: string;
  periodLabel: string;
  anchorYuan: number;
  featured: boolean;
  minImageCpu: number;
  minVideoCpu: number;
  annualSavingPct: number | null;
}) {
  const [seats, setSeats] = useState<number>(Math.max(1, plan.includedSeats));

  const bands: SeatBand[] = plan.seatTiers.map((t) => ({
    seatMin: t.seatMin,
    seatMax: t.seatMax,
    perSeatPriceYuan: t.perSeatPriceYuan,
    perSeatCredits: t.perSeatCredits,
  }));

  const minSeats = Math.max(1, plan.includedSeats);
  const quote = computeTeamSeatQuote({
    bands,
    minSeats,
    fallbackPerSeatPriceYuan: minSeats > 0 ? plan.priceYuan / minSeats : plan.priceYuan,
    fallbackPerSeatCredits: plan.monthlyCredits,
    seats,
  });

  const headlinePrice = isTeam ? quote.perSeatPriceYuan : plan.priceYuan;
  // 用于「最多生成约 …」与「1积分≈¥X」的积分口径（团队按每席）
  const basisCredits = isTeam ? quote.perSeatCredits : plan.monthlyCredits;
  const yuanPerCredit =
    basisCredits > 0 ? Math.round((headlinePrice / basisCredits) * 1000) / 1000 : anchorYuan;
  const maxImages = minImageCpu > 0 ? Math.floor(basisCredits / minImageCpu) : 0;
  const maxVideoSec = minVideoCpu > 0 ? Math.floor(basisCredits / minVideoCpu) : 0;

  const desc = (isTeam ? TEAM_DESC : PERSONAL_DESC)[index] ?? "";
  const highlights = buildHighlights({
    isTeam,
    index,
    periodLabel,
    monthlyCredits: plan.monthlyCredits,
    poolCredits: quote.creditsPool,
    maxImages,
    maxVideoSec,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      style={{ backdropFilter: "blur(10px)" }}
      className={cn(
        "relative flex w-[360px] shrink-0 flex-col overflow-visible rounded-3xl border transition-all duration-300",
        featured
          ? "z-20 border-amber-300/70 bg-gradient-to-b from-amber-50/90 to-white shadow-2xl shadow-amber-200/40 dark:border-amber-500/40 dark:from-amber-500/10 dark:to-slate-900 dark:shadow-none"
          : "border-sky-200/70 bg-white/70 hover:bg-white dark:border-slate-700/60 dark:bg-slate-900/50 dark:hover:bg-slate-900",
      )}
    >
      {/* 顶部药丸徽标：骑在顶边线上，文字中线对齐边框（见图 2） */}
      {featured || plan.promoLabel ? (
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="whitespace-nowrap rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-orange-500/20">
            {plan.promoLabel ?? "最受欢迎"}
          </div>
        </div>
      ) : null}

      {/* ===== 头部：档名 / 价格 / 描述 ===== */}
      <div className="px-6 pb-6 pt-10 text-center">
        <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {isTeam ? "团队 · " : "个人 · "}
          {plan.tier}
        </div>
        <div className="flex flex-nowrap items-baseline justify-center gap-1">
          <span className="text-5xl font-light leading-none text-foreground">¥{headlinePrice}</span>
          <span className="whitespace-nowrap text-base font-light text-muted-foreground">
            /{isTeam ? `席·${periodLabel}` : periodLabel}
          </span>
        </div>
        <div className="mt-2 flex flex-nowrap items-center justify-center gap-2 text-xs text-muted-foreground">
          {plan.originalYuan ? <span className="shrink-0 line-through">¥{plan.originalYuan}</span> : null}
          <span className="shrink-0">1积分≈¥{yuanPerCredit}</span>
          {annualSavingPct && annualSavingPct > 0 ? (
            <span className="shrink-0 font-semibold text-amber-600 dark:text-amber-400">
              年付省{annualSavingPct}%
            </span>
          ) : null}
        </div>
        <p className="mt-4 text-sm font-light leading-relaxed text-muted-foreground">{desc}</p>

        {/* 团队席位计数器 */}
        {isTeam ? (
          <div className="mt-5 rounded-xl border border-border/60 bg-background/60 px-2 py-2.5">
            <div className="flex items-center justify-between gap-2">
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
                <span className="min-w-[2.5rem] text-center text-sm font-semibold text-foreground">
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
              <div className="min-w-0 flex-1 text-right">
                <span className="inline-block whitespace-nowrap text-sm font-bold text-amber-600 dark:text-amber-400">
                  合计 ¥{quote.totalPriceYuan}/{periodLabel}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ===== 套餐亮点 ===== */}
      <div className="px-6">
        <h4 className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">套餐亮点</h4>
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
                  "flex items-center gap-1.5 text-sm font-light leading-relaxed",
                  f.included ? "text-foreground" : "text-muted-foreground line-through",
                )}
              >
                {f.text}
                {f.hasInfo ? <Info className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== 按钮 / footer ===== */}
      <div className="mt-auto px-6 pb-8 pt-6">
        <Button
          asChild
          className={cn(
            "h-12 w-full rounded-xl text-sm font-medium transition-all duration-300",
            featured
              ? "border-0 bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-lg hover:from-amber-500 hover:to-orange-400 hover:shadow-xl dark:text-black"
              : "border-border/50 bg-muted/80 text-foreground hover:bg-muted dark:bg-gray-700/80 dark:hover:bg-gray-600/80 dark:text-white",
          )}
        >
          <Link
            href={isTeam ? `/subscribe?plan=${plan.id}&seats=${quote.seats}` : `/subscribe?plan=${plan.id}`}
          >
            {isTeam ? "开通团队会员" : "立即开通"}
          </Link>
        </Button>
        <div className="mt-5 text-center">
          <p className="text-xs font-light text-muted-foreground">
            积分如何换算？{" "}
            <Link href="/pricing-disclosure" className="text-primary underline transition-colors hover:text-primary/80">
              查看明细
            </Link>
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================ 生成矩阵行 ============================ */

function GroupRow({ icon, label, span }: { icon: React.ReactNode; label: string; span: number }) {
  return (
    <TableRow className="border-sky-200/40 bg-sky-50/30 hover:bg-sky-50/30 dark:border-slate-700/40 dark:bg-slate-800/30">
      <TableCell colSpan={span} className="py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {label}
        </span>
      </TableCell>
    </TableRow>
  );
}

function ModelMatrixRow({ model, tiers }: { model: ModelPrice; tiers: Plan[] }) {
  return (
    <TableRow className="border-sky-200/30 dark:border-slate-700/40">
      <TableCell className="font-medium text-foreground">{model.displayName}</TableCell>
      <TableCell className="whitespace-nowrap text-right text-muted-foreground">
        {model.creditsPerUnit} 积分 / {unitLabel(model.unit)}
      </TableCell>
      {tiers.map((p) => (
        <TableCell key={p.id} className="whitespace-nowrap text-right font-semibold text-foreground">
          {computeTierGenerations(p.monthlyCredits, model.creditsPerUnit).toLocaleString()}
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unitLabel(model.unit)}</span>
        </TableCell>
      ))}
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
        "inline-flex items-center rounded-full font-medium transition",
        small ? "px-4 py-1.5" : "px-5 py-2",
        active
          ? "bg-sky-600 text-white shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
