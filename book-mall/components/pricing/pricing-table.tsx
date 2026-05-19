"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * 平台价目表（共享组件）。
 *
 * 由 `/pricing-disclosure` 引用（#ai-tryon 试衣 / #all-tools 其他），确保对外可见的「按次 / 按图 / 按秒」
 * 平台零售价与 ToolBillablePrice 真源同源。本组件不直接读 DB，调用方通过 `rows` 注入。
 *
 * `showPlatformCostColumns=false`（个人中心普通用户）：隐藏云挂牌价、M、公式三列（仅管理员可见）。
 *
 * 列设计：
 *   工具分组卡片头部：toolLabel + toolKey
 *   表内列：
 *     模型 / 档位 · 动作 · 云厂商产品/商品 · 计价单位
 *     [价格公示全文 / 管理员可见列] 云挂牌价（成本）· M · 平台单价 · 公式 · 点数
 *     [个人中心用户] 平台单价 · 点数
 */
export type PricingRow = {
  id: string;
  toolKey: string;
  toolLabel: string;
  action: string | null;
  /** 例：try_on（如 AI 试衣成片） / invoke（一次生成任务） */
  actionLabel: string;
  schemeARefModelKey: string | null;
  cloudTierRaw: string | null;
  cloudBillingKind: string | null;
  /** 已基于 billingKind + tier 提前算好的「计价单位」文案，如「元 / 秒（720P）」 */
  unitLabel: string;
  /** 计算公式简述：「成本 × 系数 × 100 → 取整」等 */
  formulaText: string;
  pricePoints: number;
  schemeAUnitCostYuan: number | null;
  retailMultiplier: number | null;
  vendorProductName: string | null;
  vendorCommodityName: string | null;
  modelDisplayName: string | null;
  vendor: string | null;
};

const ALL = "__all__";

function fmtMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `¥${v.toFixed(v < 1 ? 4 : 2)}`;
}

export function PricingTable({
  rows,
  /** 为 false 时隐藏「云挂牌价（成本）」「M」「公式」（个人中心普通用户）。公示页 / 管理员见全文。 */
  showPlatformCostColumns = true,
}: {
  rows: PricingRow[];
  showPlatformCostColumns?: boolean;
}) {
  const [tool, setTool] = useState<string>(ALL);
  const [model, setModel] = useState<string>(ALL);
  const [q, setQ] = useState<string>("");
  const qDeferred = useDeferredValue(q);

  const tools = useMemo(() => {
    const map = new Map<string, { toolKey: string; toolLabel: string; count: number }>();
    for (const r of rows) {
      const ex = map.get(r.toolKey) ?? { toolKey: r.toolKey, toolLabel: r.toolLabel, count: 0 };
      ex.count += 1;
      map.set(r.toolKey, ex);
    }
    return Array.from(map.values()).sort((a, b) => a.toolLabel.localeCompare(b.toolLabel, "zh-CN"));
  }, [rows]);

  const models = useMemo(() => {
    const scoped = tool === ALL ? rows : rows.filter((r) => r.toolKey === tool);
    const set = new Map<string, number>();
    for (const r of scoped) {
      if (!r.schemeARefModelKey) continue;
      set.set(r.schemeARefModelKey, (set.get(r.schemeARefModelKey) ?? 0) + 1);
    }
    return Array.from(set.entries())
      .map(([modelKey, count]) => ({ modelKey, count }))
      .sort((a, b) => a.modelKey.localeCompare(b.modelKey));
  }, [rows, tool]);

  const filtered = useMemo(() => {
    const text = qDeferred.trim().toLowerCase();
    return rows.filter((r) => {
      if (tool !== ALL && r.toolKey !== tool) return false;
      if (model !== ALL && r.schemeARefModelKey !== model) return false;
      if (!text) return true;
      const hay = [
        r.toolKey,
        r.toolLabel,
        r.action ?? "",
        r.actionLabel,
        r.schemeARefModelKey ?? "",
        r.cloudTierRaw ?? "",
        r.cloudBillingKind ?? "",
        r.vendorProductName ?? "",
        r.vendorCommodityName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(text);
    });
  }, [rows, tool, model, qDeferred]);

  const grouped = useMemo(() => {
    const map = new Map<string, PricingRow[]>();
    for (const r of filtered) {
      const arr = map.get(r.toolKey) ?? [];
      arr.push(r);
      map.set(r.toolKey, arr);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1][0]!.toolLabel.localeCompare(b[1][0]!.toolLabel, "zh-CN"),
    );
  }, [filtered]);

  const totalCount = filtered.length;
  const toolCount = grouped.length;
  const hasAnyFilter = tool !== ALL || model !== ALL || q.trim().length > 0;

  const reduceMotion = useReducedMotion();
  const rowVariants = useMemo(
    () => ({
      hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 16 },
      visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
          delay: reduceMotion ? 0 : i * 0.05,
          duration: reduceMotion ? 0 : 0.34,
          ease: [0.22, 1, 0.36, 1] as const,
        },
      }),
    }),
    [reduceMotion],
  );

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={0}>
      <div className="space-y-5">
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[260px_1fr] md:items-center">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">工具</label>
            <Select
              value={tool}
              onValueChange={(v) => {
                setTool(v);
                setModel(ALL);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="全部工具" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>
                  全部工具（{tools.reduce((s, t) => s + t.count, 0)} 行）
                </SelectItem>
                {tools.map((t) => (
                  <SelectItem key={t.toolKey} value={t.toolKey}>
                    {t.toolLabel}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t.toolKey} · {t.count} 行
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">关键字（实时筛选）</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="可输入：模型片段、动作、计费类型、厂商商品名；不输入即不过滤"
                className="pl-8 pr-9"
              />
              {q.length > 0 ? (
                <button
                  type="button"
                  aria-label="清空"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {models.length > 0 ? (
          <div className="mt-4 space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">
              模型（点击切换；当前工具下 {models.length} 个）
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setModel(ALL)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  model === ALL
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
              >
                全部 ({models.reduce((s, m) => s + m.count, 0)})
              </button>
              {models.map((m) => (
                <button
                  key={m.modelKey}
                  type="button"
                  onClick={() => setModel(m.modelKey)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                    model === m.modelKey
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                  title={`${m.modelKey} · ${m.count} 行`}
                >
                  {m.modelKey}
                  <span className="ml-1 opacity-70">({m.count})</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>
            命中 {totalCount} 行 / {toolCount} 个工具
          </span>
          {hasAnyFilter ? (
            <button
              type="button"
              onClick={() => {
                setTool(ALL);
                setModel(ALL);
                setQ("");
              }}
              className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"
            >
              清除筛选
            </button>
          ) : null}
        </div>
      </section>

      <div className="space-y-4">
        {grouped.map(([toolKey, list]) => (
          <section
            key={toolKey}
            className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm"
          >
            <header className="flex flex-wrap items-baseline gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
              <span className="text-sm font-medium text-foreground">{list[0]!.toolLabel}</span>
              <code className="text-xs text-muted-foreground">{toolKey}</code>
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {list.length} 行
              </Badge>
            </header>
            <Table
              className={cn(showPlatformCostColumns ? "min-w-[1180px]" : "min-w-[720px]")}
            >
              <TableHeader>
                <TableRow className="text-muted-foreground hover:bg-transparent">
                  <TableHead className="h-auto px-3 py-2 text-left text-xs font-medium">
                    模型 / 档位
                  </TableHead>
                  <TableHead className="h-auto px-3 py-2 text-left text-xs font-medium">动作</TableHead>
                  <TableHead className="h-auto px-3 py-2 text-left text-xs font-medium">
                    云厂商产品 / 商品
                  </TableHead>
                  <TableHead className="h-auto px-3 py-2 text-left text-xs font-medium">
                    计价单位
                  </TableHead>
                  {showPlatformCostColumns ? (
                    <>
                      <TableHead className="h-auto px-3 py-2 text-right text-xs font-medium">
                        云挂牌价（成本）
                      </TableHead>
                      <TableHead className="h-auto px-3 py-2 text-right text-xs font-medium">
                        系数
                      </TableHead>
                    </>
                  ) : null}
                  <TableHead className="h-auto px-3 py-2 text-right text-xs font-medium">
                    平台单价
                  </TableHead>
                  {showPlatformCostColumns ? (
                    <TableHead className="h-auto max-w-[11rem] w-[11rem] px-3 py-2 text-left text-xs font-medium">
                      公式
                    </TableHead>
                  ) : null}
                  <TableHead className="h-auto whitespace-nowrap px-3 py-2 text-right text-xs font-medium">
                    点数
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r, rowIndex) => {
                  const ours =
                    r.schemeAUnitCostYuan != null && r.retailMultiplier != null
                      ? r.schemeAUnitCostYuan * r.retailMultiplier
                      : null;
                  return (
                    <motion.tr
                      key={r.id}
                      custom={rowIndex}
                      initial="hidden"
                      animate="visible"
                      variants={rowVariants}
                      className={cn(
                        "border-b text-sm transition-colors",
                        "hover:bg-muted/50 data-[state=selected]:bg-muted",
                      )}
                    >
                      <TableCell className="px-3 py-2.5 align-middle">
                        <div className="font-semibold leading-snug tracking-tight text-foreground">
                          {r.modelDisplayName ?? "—"}
                        </div>
                        <code className="text-[11px] text-muted-foreground">
                          {r.schemeARefModelKey ?? "—"}
                          {r.cloudTierRaw ? <> · {r.cloudTierRaw}</> : null}
                        </code>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-xs align-middle">
                        <code className="text-muted-foreground">{r.action ?? "(*)"}</code>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-muted-foreground align-middle">
                        <div>{r.vendorProductName ?? "—"}</div>
                        <div className="text-[11px] opacity-80">{r.vendorCommodityName ?? "—"}</div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-muted-foreground align-middle">
                        {r.unitLabel}
                        {r.cloudBillingKind ? (
                          <Badge
                            variant="outline"
                            className="ml-1 align-middle font-mono text-[9px]"
                          >
                            {r.cloudBillingKind}
                          </Badge>
                        ) : null}
                      </TableCell>
                      {showPlatformCostColumns ? (
                        <>
                          <TableCell className="px-3 py-2.5 text-right align-middle tabular-nums text-muted-foreground">
                            {fmtMoney(r.schemeAUnitCostYuan)}
                          </TableCell>
                          <TableCell className="px-3 py-2.5 text-right align-middle tabular-nums text-muted-foreground">
                            {r.retailMultiplier != null ? `×${r.retailMultiplier}` : "—"}
                          </TableCell>
                        </>
                      ) : null}
                      <TableCell className="px-3 py-2.5 text-right align-middle font-medium tabular-nums text-foreground">
                        {fmtMoney(ours)}
                      </TableCell>
                      {showPlatformCostColumns ? (
                        <TableCell className="max-w-[11rem] w-[11rem] px-3 py-2.5 text-xs text-muted-foreground align-middle">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <code className="block w-full min-w-0 cursor-help truncate border-b border-dotted border-muted-foreground/45 text-[11px] underline-offset-2">
                                {r.formulaText}
                              </code>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              align="start"
                              className="max-w-lg whitespace-pre-wrap break-words text-left font-mono text-sm leading-relaxed"
                            >
                              {r.formulaText}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      ) : null}
                      <TableCell className="whitespace-nowrap px-3 py-2.5 text-right align-middle font-medium tabular-nums text-foreground">
                        {r.pricePoints.toLocaleString("zh-CN")} 点
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </section>
        ))}
        {grouped.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
            没有符合筛选条件的价目。
            {hasAnyFilter ? (
              <button
                type="button"
                onClick={() => {
                  setTool(ALL);
                  setModel(ALL);
                  setQ("");
                }}
                className="ml-1 text-primary hover:underline"
              >
                清除筛选
              </button>
            ) : null}
          </div>
        ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
