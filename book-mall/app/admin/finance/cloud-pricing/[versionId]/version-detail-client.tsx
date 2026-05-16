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
import { unitLabelFor } from "@/lib/finance/billable-row-classifier";

export type DetailRow = {
  id: string;
  sectionH2: string;
  sectionH3: string | null;
  modelKey: string;
  tierRaw: string | null;
  billingKind: string;
  inputYuanPerMillion: number | null;
  outputYuanPerMillion: number | null;
  costJson: unknown | null;
};

const ALL = "__all__";

export function VersionDetailClient({ rows }: { rows: DetailRow[] }) {
  const [bk, setBk] = useState<string>(ALL);
  const [section, setSection] = useState<string>(ALL);
  const [q, setQ] = useState<string>("");
  const qDeferred = useDeferredValue(q);

  const billingKinds = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.billingKind, (m.get(r.billingKind) ?? 0) + 1);
    return Array.from(m.entries())
      .map(([k, c]) => ({ key: k, count: c }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [rows]);

  const sections = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.sectionH2, (m.get(r.sectionH2) ?? 0) + 1);
    return Array.from(m.entries())
      .map(([k, c]) => ({ key: k, count: c }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [rows]);

  /** 模型 chip:基于已选 billingKind / section 缩小集合 */
  const models = useMemo(() => {
    const scope = rows.filter((r) => {
      if (bk !== ALL && r.billingKind !== bk) return false;
      if (section !== ALL && r.sectionH2 !== section) return false;
      return true;
    });
    const m = new Map<string, number>();
    for (const r of scope) m.set(r.modelKey, (m.get(r.modelKey) ?? 0) + 1);
    return Array.from(m.entries())
      .map(([k, c]) => ({ key: k, count: c }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [rows, bk, section]);

  const [modelKey, setModelKey] = useState<string>(ALL);

  const filtered = useMemo(() => {
    const text = qDeferred.trim().toLowerCase();
    return rows.filter((r) => {
      if (bk !== ALL && r.billingKind !== bk) return false;
      if (section !== ALL && r.sectionH2 !== section) return false;
      if (modelKey !== ALL && r.modelKey !== modelKey) return false;
      if (!text) return true;
      const hay = [
        r.modelKey,
        r.tierRaw ?? "",
        r.sectionH2,
        r.sectionH3 ?? "",
        r.billingKind,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(text);
    });
  }, [rows, bk, section, modelKey, qDeferred]);

  const hasAnyFilter =
    bk !== ALL || section !== ALL || modelKey !== ALL || q.trim().length > 0;

  function clearAll() {
    setBk(ALL);
    setSection(ALL);
    setModelKey(ALL);
    setQ("");
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[200px_200px_1fr] md:items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">计费类型</label>
            <Select
              value={bk}
              onValueChange={(v) => {
                setBk(v);
                setModelKey(ALL);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部</SelectItem>
                {billingKinds.map((b) => (
                  <SelectItem key={b.key} value={b.key}>
                    {b.key}
                    <span className="ml-1 text-muted-foreground text-xs">({b.count})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">章节(H2)</label>
            <Select
              value={section}
              onValueChange={(v) => {
                setSection(v);
                setModelKey(ALL);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部章节</SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.key}
                    <span className="ml-1 text-muted-foreground text-xs">({s.count})</span>
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
                placeholder="模型片段 / tier / 章节"
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

        {models.length > 0 && models.length <= 80 ? (
          <div className="mt-3 space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">
              模型（点击切换；当前作用域 {models.length} 个）
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setModelKey(ALL)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  modelKey === ALL
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
              >
                全部 ({models.reduce((s, m) => s + m.count, 0)})
              </button>
              {models.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setModelKey(m.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                    modelKey === m.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                  title={`${m.key} · ${m.count} 行`}
                >
                  {m.key}
                  <span className="ml-1 opacity-70">({m.count})</span>
                </button>
              ))}
            </div>
          </div>
        ) : models.length > 80 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            当前作用域模型数 {models.length} 超过 80 个，已折叠 chip；请用「关键字」精确筛选。
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>命中 {filtered.length} 行</span>
          {hasAnyFilter ? (
            <button
              type="button"
              onClick={clearAll}
              className="rounded border border-border px-2 py-0.5 hover:bg-muted"
            >
              清除筛选
            </button>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="border-b border-border bg-muted/40 px-2.5 py-2 text-left font-medium">章节</th>
                <th className="border-b border-border bg-muted/40 px-2.5 py-2 text-left font-medium">模型</th>
                <th className="border-b border-border bg-muted/40 px-2.5 py-2 text-left font-medium">tier</th>
                <th className="border-b border-border bg-muted/40 px-2.5 py-2 text-left font-medium">计价标准</th>
                <th className="border-b border-border bg-muted/40 px-2.5 py-2 text-left font-medium">计价单位</th>
                <th className="border-b border-border bg-muted/40 px-2.5 py-2 text-right font-medium">
                  in (元/MTok)
                </th>
                <th className="border-b border-border bg-muted/40 px-2.5 py-2 text-right font-medium">
                  out (元/MTok)
                </th>
                <th className="border-b border-border bg-muted/40 px-2.5 py-2 text-left font-medium">costJson</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-muted/30">
                  <td className="border-b border-border/60 px-2.5 py-1.5 text-foreground">
                    {l.sectionH2}
                    {l.sectionH3 ? (
                      <span className="text-muted-foreground"> / {l.sectionH3}</span>
                    ) : null}
                  </td>
                  <td className="border-b border-border/60 px-2.5 py-1.5">
                    <code className="text-foreground">{l.modelKey}</code>
                  </td>
                  <td className="border-b border-border/60 px-2.5 py-1.5 text-muted-foreground">
                    {l.tierRaw || "—"}
                  </td>
                  <td className="border-b border-border/60 px-2.5 py-1.5">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {l.billingKind}
                    </Badge>
                  </td>
                  <td className="border-b border-border/60 px-2.5 py-1.5 text-muted-foreground">
                    {unitLabelFor(l.billingKind as never, l.tierRaw)}
                  </td>
                  <td className="border-b border-border/60 px-2.5 py-1.5 text-right tabular-nums">
                    {l.inputYuanPerMillion ?? "—"}
                  </td>
                  <td className="border-b border-border/60 px-2.5 py-1.5 text-right tabular-nums">
                    {l.outputYuanPerMillion ?? "—"}
                  </td>
                  <td className="border-b border-border/60 px-2.5 py-1.5">
                    {l.costJson ? (
                      <code className="text-[10px] text-muted-foreground">
                        {JSON.stringify(l.costJson)}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    未匹配到行。
                    {hasAnyFilter ? (
                      <button
                        type="button"
                        onClick={clearAll}
                        className="ml-1 text-primary hover:underline"
                      >
                        清除筛选
                      </button>
                    ) : null}
                  </td>
                </tr>
              ) : null}
              {filtered.length > 500 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-3 text-center text-xs text-muted-foreground">
                    已展示前 500 行；请进一步筛选以查看其它行。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
