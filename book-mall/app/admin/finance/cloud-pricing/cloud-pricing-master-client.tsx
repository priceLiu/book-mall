"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { downloadCsv, rowsToCsv, tsForFilename } from "@/lib/csv-export";

export type MasterRow = {
  id: string;
  toolKey: string;
  toolLabel: string;
  action: string | null;
  modelKey: string | null;
  cloudVendor: string;
  costYuan: number | null;
  multiplier: number | null;
  pricePoints: number;
  billingKind: string | null;
  unitLabel: string;
  formulaText: string;
};

const ALL = "__all__";

function fmtMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `¥${v.toFixed(4).replace(/\.?0+$/, "")}`;
}

function fmtMul(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `×${v}`;
}

export function CloudPricingMasterClient({ rows }: { rows: MasterRow[] }) {
  const [vendor, setVendor] = useState<string>(ALL);
  const [tool, setTool] = useState<string>(ALL);
  const [bk, setBk] = useState<string>(ALL);
  const [q, setQ] = useState<string>("");
  const qDeferred = useDeferredValue(q);

  const vendors = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.cloudVendor, (m.get(r.cloudVendor) ?? 0) + 1);
    return Array.from(m.entries())
      .map(([k, c]) => ({ key: k, count: c }))
      .sort((a, b) => a.key.localeCompare(b.key, "zh-CN"));
  }, [rows]);

  const tools = useMemo(() => {
    const scope = vendor === ALL ? rows : rows.filter((r) => r.cloudVendor === vendor);
    const m = new Map<string, { toolKey: string; toolLabel: string; count: number }>();
    for (const r of scope) {
      const ex = m.get(r.toolKey) ?? { toolKey: r.toolKey, toolLabel: r.toolLabel, count: 0 };
      ex.count += 1;
      m.set(r.toolKey, ex);
    }
    return Array.from(m.values()).sort((a, b) => a.toolLabel.localeCompare(b.toolLabel, "zh-CN"));
  }, [rows, vendor]);

  const billingKinds = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const key = r.billingKind ?? "—";
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([k, c]) => ({ key: k, count: c }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [rows]);

  const filtered = useMemo(() => {
    const text = qDeferred.trim().toLowerCase();
    return rows.filter((r) => {
      if (vendor !== ALL && r.cloudVendor !== vendor) return false;
      if (tool !== ALL && r.toolKey !== tool) return false;
      if (bk !== ALL && (r.billingKind ?? "—") !== bk) return false;
      if (!text) return true;
      const hay = [
        r.toolKey,
        r.toolLabel,
        r.action ?? "",
        r.modelKey ?? "",
        r.cloudVendor,
        r.billingKind ?? "",
        r.unitLabel,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(text);
    });
  }, [rows, vendor, tool, bk, qDeferred]);

  /** 按云厂商分组（一组一个 Card） */
  const grouped = useMemo(() => {
    const m = new Map<string, MasterRow[]>();
    for (const r of filtered) {
      const k = r.cloudVendor;
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "zh-CN"));
  }, [filtered]);

  const hasAnyFilter = vendor !== ALL || tool !== ALL || bk !== ALL || q.trim().length > 0;

  function clearAll() {
    setVendor(ALL);
    setTool(ALL);
    setBk(ALL);
    setQ("");
  }

  /** 导出当前筛选结果为 CSV；不分文件，文件名含厂商 + 时间戳。 */
  function exportFiltered() {
    if (filtered.length === 0) return;
    const csv = rowsToCsv(
      [
        { key: "cloudVendor", label: "云厂商" },
        { key: "toolLabel", label: "工具" },
        { key: "toolKey", label: "toolKey" },
        { key: "action", label: "动作" },
        { key: "modelKey", label: "模型" },
        { key: "costYuan", label: "成本价(¥)" },
        { key: "multiplier", label: "系数 M" },
        { key: "pricePoints", label: "对外单价(点)" },
        { key: "priceYuan", label: "对外单价(¥)" },
        { key: "billingKind", label: "计价标准" },
        { key: "unitLabel", label: "计价单位" },
        { key: "formulaText", label: "计算公式" },
      ],
      filtered.map((r) => ({
        cloudVendor: r.cloudVendor,
        toolLabel: r.toolLabel,
        toolKey: r.toolKey,
        action: r.action ?? "(*)",
        modelKey: r.modelKey ?? "",
        costYuan: r.costYuan ?? "",
        multiplier: r.multiplier ?? "",
        pricePoints: r.pricePoints,
        priceYuan: (r.pricePoints / 100).toFixed(2),
        billingKind: r.billingKind ?? "",
        unitLabel: r.unitLabel,
        formulaText: r.formulaText,
      })),
    );
    const vendorSlug = vendor === ALL ? "all-vendors" : vendor;
    downloadCsv(`cloud-pricing-${vendorSlug}-${tsForFilename()}.csv`, csv);
  }

  /** 按厂商**分文件**导出（每家一个 CSV，用户筛选无关）。 */
  function exportPerVendor() {
    if (rows.length === 0) return;
    const stamp = tsForFilename();
    for (const v of vendors) {
      const subset = rows.filter((r) => r.cloudVendor === v.key);
      if (subset.length === 0) continue;
      const csv = rowsToCsv(
        [
          { key: "cloudVendor", label: "云厂商" },
          { key: "toolLabel", label: "工具" },
          { key: "toolKey", label: "toolKey" },
          { key: "action", label: "动作" },
          { key: "modelKey", label: "模型" },
          { key: "costYuan", label: "成本价(¥)" },
          { key: "multiplier", label: "系数 M" },
          { key: "pricePoints", label: "对外单价(点)" },
          { key: "priceYuan", label: "对外单价(¥)" },
          { key: "billingKind", label: "计价标准" },
          { key: "unitLabel", label: "计价单位" },
          { key: "formulaText", label: "计算公式" },
        ],
        subset.map((r) => ({
          cloudVendor: r.cloudVendor,
          toolLabel: r.toolLabel,
          toolKey: r.toolKey,
          action: r.action ?? "(*)",
          modelKey: r.modelKey ?? "",
          costYuan: r.costYuan ?? "",
          multiplier: r.multiplier ?? "",
          pricePoints: r.pricePoints,
          priceYuan: (r.pricePoints / 100).toFixed(2),
          billingKind: r.billingKind ?? "",
          unitLabel: r.unitLabel,
          formulaText: r.formulaText,
        })),
      );
      downloadCsv(`cloud-pricing-${v.key}-${stamp}.csv`, csv);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[200px_200px_200px_1fr] md:items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">云厂商</label>
            <Select
              value={vendor}
              onValueChange={(v) => {
                setVendor(v);
                setTool(ALL);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="全部厂商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部厂商（{rows.length}）</SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.key} value={v.key}>
                    {v.key} <span className="ml-1 text-muted-foreground">({v.count})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">工具</label>
            <Select value={tool} onValueChange={setTool}>
              <SelectTrigger>
                <SelectValue placeholder="全部工具" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部工具</SelectItem>
                {tools.map((t) => (
                  <SelectItem key={t.toolKey} value={t.toolKey}>
                    {t.toolLabel}
                    <span className="ml-1 text-muted-foreground text-xs">({t.count})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">计费类型</label>
            <Select value={bk} onValueChange={setBk}>
              <SelectTrigger>
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部</SelectItem>
                {billingKinds.map((b) => (
                  <SelectItem key={b.key} value={b.key}>
                    {b.key} <span className="ml-1 text-muted-foreground text-xs">({b.count})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">关键字</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="模型片段 / 工具名 / 计价类型，例如 wan2.6、试衣、TOKEN"
                className="pl-8 pr-9"
              />
              {q.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="清空"
                  className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>
            命中 {filtered.length} 行 / {grouped.length} 个厂商分组
          </span>
          {hasAnyFilter ? (
            <button
              type="button"
              onClick={clearAll}
              className="rounded border border-border px-2 py-0.5 hover:bg-muted"
            >
              清除筛选
            </button>
          ) : null}
          <span className="ml-auto inline-flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={exportFiltered}
              disabled={filtered.length === 0}
            >
              <Download className="mr-1 h-3.5 w-3.5" aria-hidden />
              导出 CSV（当前筛选 {filtered.length}）
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={exportPerVendor}
              disabled={rows.length === 0}
              title="为每个云厂商分别下载一份 CSV"
            >
              <Download className="mr-1 h-3.5 w-3.5" aria-hidden />
              按厂商分文件导出
            </Button>
          </span>
        </div>
      </section>

      <div className="space-y-4">
        {grouped.map(([vendorName, list]) => (
          <section
            key={vendorName}
            className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
          >
            <header className="flex flex-wrap items-baseline gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
              <span className="text-sm font-medium text-foreground">{vendorName}</span>
              <Badge variant="secondary" className="text-[10px]">
                {list.length} 行
              </Badge>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="border-b border-border px-3 py-2 text-left font-medium">工具</th>
                    <th className="border-b border-border px-3 py-2 text-left font-medium">动作</th>
                    <th className="border-b border-border px-3 py-2 text-left font-medium">模型</th>
                    <th className="border-b border-border px-3 py-2 text-right font-medium">成本价</th>
                    <th className="border-b border-border px-3 py-2 text-right font-medium">系数</th>
                    <th className="border-b border-border px-3 py-2 text-right font-medium">对外单价</th>
                    <th className="border-b border-border px-3 py-2 text-left font-medium">计价标准</th>
                    <th className="border-b border-border px-3 py-2 text-left font-medium">计价单位</th>
                    <th className="border-b border-border px-3 py-2 text-left font-medium">公式</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr
                      key={r.id}
                      className="text-sm transition-colors hover:bg-muted/30"
                    >
                      <td className="border-b border-border/60 px-3 py-2">
                        <div className="text-foreground">{r.toolLabel}</div>
                        <code className="text-[10px] text-muted-foreground">{r.toolKey}</code>
                      </td>
                      <td className="border-b border-border/60 px-3 py-2">
                        <code className="text-xs text-muted-foreground">{r.action ?? "(*)"}</code>
                      </td>
                      <td className="border-b border-border/60 px-3 py-2">
                        <code className="text-xs text-foreground">{r.modelKey ?? "—"}</code>
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-right tabular-nums">
                        {fmtMoney(r.costYuan)}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-right tabular-nums">
                        {fmtMul(r.multiplier)}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-right tabular-nums">
                        <div className="font-medium text-foreground">{r.pricePoints} 点</div>
                        <div className="text-[10px] text-muted-foreground">
                          ≈ ¥{(r.pricePoints / 100).toFixed(2)}
                        </div>
                      </td>
                      <td className="border-b border-border/60 px-3 py-2">
                        {r.billingKind ? (
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {r.billingKind}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
                        {r.unitLabel}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
                        <code className="text-[11px]">{r.formulaText}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        {grouped.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
            没有符合筛选条件的价目。
            {hasAnyFilter ? (
              <button
                type="button"
                onClick={clearAll}
                className="ml-1 text-primary hover:underline"
              >
                清除筛选
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 由 modelKey 推断云厂商；未知归到「其他/未知」。
 *  这一规则是 best-effort，未来若 ToolBillablePrice 加 vendor 列再替换。 */
export function vendorOfModelKey(modelKey: string | null | undefined): string {
  if (!modelKey) return "未知";
  const k = modelKey.toLowerCase();
  if (
    k.startsWith("qwen") ||
    k.startsWith("wan") ||
    k.startsWith("dashscope") ||
    k.startsWith("wanx") ||
    k.startsWith("aitryon")
  )
    return "阿里云";
  if (k.startsWith("hunyuan") || k.startsWith("tencent")) return "腾讯云";
  if (k.startsWith("doubao") || k.startsWith("volc") || k.startsWith("ark")) return "火山引擎";
  if (k.startsWith("baichuan")) return "百川";
  if (k.startsWith("moonshot") || k.startsWith("kimi")) return "Moonshot";
  if (k.startsWith("deepseek")) return "DeepSeek";
  if (k.startsWith("glm") || k.startsWith("chatglm") || k.startsWith("zhipu")) return "智谱 AI";
  if (k.startsWith("ernie") || k.startsWith("wenxin")) return "百度文心";
  if (k.startsWith("step") || k.startsWith("yi-")) return "其他";
  if (k.startsWith("pixverse") || k.startsWith("happyhorse")) return "其他";
  return "其他";
}

export { unitLabelFor, formulaTextFor } from "@/lib/finance/billable-row-classifier";
