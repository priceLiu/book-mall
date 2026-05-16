"use client";

import { useDeferredValue, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";

export type PricingRow = {
  id: string;
  toolKey: string;
  toolLabel: string;
  action: string | null;
  schemeARefModelKey: string | null;
  cloudTierRaw: string | null;
  cloudBillingKind: string | null;
  /** 已基于 billingKind + tier 提前算好的「计价单位」文案，如「元 / 秒（720P）」 */
  unitLabel: string;
  pricePoints: number;
};

const ALL = "__all__";

export function PricingTableClient({ rows }: { rows: PricingRow[] }) {
  const [tool, setTool] = useState<string>(ALL);
  const [model, setModel] = useState<string>(ALL);
  const [q, setQ] = useState<string>("");
  const qDeferred = useDeferredValue(q);

  /** 工具维度：从 rows 抽取出唯一工具列表（label + key + 行数） */
  const tools = useMemo(() => {
    const map = new Map<string, { toolKey: string; toolLabel: string; count: number }>();
    for (const r of rows) {
      const ex = map.get(r.toolKey) ?? { toolKey: r.toolKey, toolLabel: r.toolLabel, count: 0 };
      ex.count += 1;
      map.set(r.toolKey, ex);
    }
    return Array.from(map.values()).sort((a, b) => a.toolLabel.localeCompare(b.toolLabel, "zh-CN"));
  }, [rows]);

  /** 模型 chip：只列出当前所选工具范围内的唯一模型 */
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

  /** 真正展示的行 */
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
        r.schemeARefModelKey ?? "",
        r.cloudTierRaw ?? "",
        r.cloudBillingKind ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(text);
    });
  }, [rows, tool, model, qDeferred]);

  /** 按工具分组结果（保持原页"每工具一表"风格） */
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

  return (
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
                placeholder="可输入：模型片段、动作、计费类型；不输入即不过滤"
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
            className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
          >
            <header className="flex flex-wrap items-baseline gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
              <span className="text-sm font-medium text-foreground">
                {list[0]!.toolLabel}
              </span>
              <code className="text-xs text-muted-foreground">{toolKey}</code>
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {list.length} 行
              </Badge>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="border-b border-border px-3 py-2 text-left font-medium">动作</th>
                    <th className="border-b border-border px-3 py-2 text-left font-medium">模型</th>
                    <th className="border-b border-border px-3 py-2 text-left font-medium">计价标准</th>
                    <th className="border-b border-border px-3 py-2 text-left font-medium">计价单位</th>
                    <th className="border-b border-border px-3 py-2 text-right font-medium">单价（点）</th>
                    <th className="border-b border-border px-3 py-2 text-right font-medium">≈ 元</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr
                      key={r.id}
                      className="text-sm transition-colors hover:bg-muted/30"
                    >
                      <td className="border-b border-border/60 px-3 py-2">
                        <code className="text-xs text-muted-foreground">{r.action ?? "(*)"}</code>
                      </td>
                      <td className="border-b border-border/60 px-3 py-2">
                        <code className="text-xs text-foreground">{r.schemeARefModelKey ?? "—"}</code>
                      </td>
                      <td className="border-b border-border/60 px-3 py-2">
                        {r.cloudBillingKind ? (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {r.cloudBillingKind}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
                        {r.unitLabel}
                        {r.cloudTierRaw && !r.unitLabel.includes(r.cloudTierRaw) ? (
                          <span className="ml-1 text-[10px] opacity-70">· {r.cloudTierRaw}</span>
                        ) : null}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-right font-medium text-foreground tabular-nums">
                        {r.pricePoints} 点
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-right text-muted-foreground tabular-nums">
                        ¥{(r.pricePoints / 100).toFixed(2)}
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
  );
}
