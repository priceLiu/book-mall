"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GenerationSubmitTier } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SUBMIT_BURST_HEAVY_DEFAULT,
  SUBMIT_WINDOW_SEC,
} from "@/lib/generation/submit-rate/constants";

type Tab = "users" | "tenants";

type QuotaRow = {
  id: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  role?: string;
  ownerEmail?: string | null;
  ownerName?: string | null;
  status?: string;
  seatLimit?: number;
  configuredTier: GenerationSubmitTier | null;
  configuredTierLabel: string | null;
  burstOverride: number | null;
  effectiveTier: GenerationSubmitTier;
  effectiveTierLabel: string;
  effectiveBurstLimit: number;
  stampedBurstLimit: number | null;
  stampedAt: string | null;
};

type ListResponse = {
  items: QuotaRow[];
  page: number;
  pageSize: number;
  total: number;
};

const TIER_OPTIONS: { value: GenerationSubmitTier | ""; label: string }[] = [
  { value: "", label: "全部档位" },
  { value: "STANDARD", label: "普通" },
  { value: "ELEVATED", label: "中度" },
  { value: "HEAVY", label: "重度" },
];

const BATCH_TIERS: { value: GenerationSubmitTier; label: string }[] = [
  { value: "STANDARD", label: "普通" },
  { value: "ELEVATED", label: "中度" },
  { value: "HEAVY", label: "重度" },
];

export function AdminGenerationQuotaClient() {
  const [tab, setTab] = useState<Tab>("users");
  const [q, setQ] = useState("");
  const [tierFilter, setTierFilter] = useState<GenerationSubmitTier | "">("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<QuotaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchTier, setBatchTier] = useState<GenerationSubmitTier>("STANDARD");
  const [burstOverride, setBurstOverride] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const apiBase = tab === "users" ? "/api/admin/generation-quota/users" : "/api/admin/generation-quota/tenants";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (q.trim()) params.set("q", q.trim());
      if (tierFilter) params.set("tier", tierFilter);
      const res = await fetch(`${apiBase}?${params.toString()}`);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `加载失败 (${res.status})`);
      }
      const data = (await res.json()) as ListResponse;
      setRows(data.items);
      setTotal(data.total);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [apiBase, page, q, tierFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected],
  );

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function applyBatch() {
    if (selected.size === 0) {
      setMessage("请先选择至少一条记录");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        tier: batchTier,
      };
      if (batchTier === "HEAVY" && burstOverride.trim()) {
        body.burstOverride = Number(burstOverride);
      }
      if (tab === "users") {
        body.userIds = Array.from(selected);
      } else {
        body.tenantIds = Array.from(selected);
      }

      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `保存失败 (${res.status})`);
      }
      const j = (await res.json()) as { updated?: number };
      setMessage(`已更新 ${j.updated ?? selected.size} 条`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function rowLabel(row: QuotaRow): string {
    if (tab === "users") {
      return row.email ?? row.phone ?? row.name ?? row.id;
    }
    return row.name ?? row.id;
  }

  const pageCount = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === "users" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setTab("users");
            setPage(1);
          }}
        >
          用户
        </Button>
        <Button
          type="button"
          variant={tab === "tenants" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setTab("tenants");
            setPage(1);
          }}
        >
          团队
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="quota-search">搜索</Label>
          <Input
            id="quota-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "users" ? "邮箱 / 昵称 / 手机" : "团队名称"}
            className="w-64"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="quota-tier-filter">档位筛选</Label>
          <select
            id="quota-tier-filter"
            className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={tierFilter}
            onChange={(e) => {
              setTierFilter(e.target.value as GenerationSubmitTier | "");
              setPage(1);
            }}
          >
            {TIER_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? "加载中…" : "刷新"}
        </Button>
      </div>

      <div className="rounded-lg border border-secondary p-4 space-y-3">
        <p className="text-sm font-medium">批量设置（已选 {selected.size} 条）</p>
        <div className="flex flex-wrap items-end gap-3">
          {BATCH_TIERS.map((t) => (
            <Button
              key={t.value}
              type="button"
              size="sm"
              variant={batchTier === t.value ? "default" : "outline"}
              onClick={() => setBatchTier(t.value)}
            >
              {t.label}
            </Button>
          ))}
          {batchTier === "HEAVY" ? (
            <div className="space-y-1">
              <Label htmlFor="burst-override">重度 burst（{SUBMIT_WINDOW_SEC}s 窗口）</Label>
              <Input
                id="burst-override"
                type="number"
                min={1}
                max={500}
                placeholder={String(SUBMIT_BURST_HEAVY_DEFAULT)}
                value={burstOverride}
                onChange={(e) => setBurstOverride(e.target.value)}
                className="w-32"
              />
            </div>
          ) : null}
          <Button type="button" size="sm" onClick={() => void applyBatch()} disabled={saving}>
            {saving ? "保存中…" : "应用"}
          </Button>
        </div>
        {message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-secondary bg-muted/50">
            <tr>
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                  aria-label="全选"
                />
              </th>
              <th className="p-3 font-medium">{tab === "users" ? "用户" : "团队"}</th>
              <th className="p-3 font-medium">配置档位</th>
              <th className="p-3 font-medium">生效档位</th>
              <th className="p-3 font-medium">burst 上限</th>
              <th className="p-3 font-medium">stamp 时间</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-secondary/80 last:border-0">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={(e) => toggleOne(row.id, e.target.checked)}
                    aria-label={`选择 ${rowLabel(row)}`}
                  />
                </td>
                <td className="p-3">
                  <div className="font-medium">{rowLabel(row)}</div>
                  {tab === "tenants" ? (
                    <div className="text-xs text-muted-foreground">
                      负责人：{row.ownerEmail ?? row.ownerName ?? "—"}
                    </div>
                  ) : row.role ? (
                    <div className="text-xs text-muted-foreground">{row.role}</div>
                  ) : null}
                </td>
                <td className="p-3">{row.configuredTierLabel ?? "（未配置）"}</td>
                <td className="p-3">{row.effectiveTierLabel}</td>
                <td className="p-3 tabular-nums">
                  {row.effectiveBurstLimit}
                  {row.burstOverride ? (
                    <span className="text-xs text-muted-foreground">（override {row.burstOverride}）</span>
                  ) : null}
                </td>
                <td className="p-3 text-muted-foreground tabular-nums text-xs">
                  {row.stampedAt ? new Date(row.stampedAt).toLocaleString("zh-CN") : "—"}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  无匹配记录
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          共 {total} 条 · 第 {page} / {pageCount} 页
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= pageCount || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}
