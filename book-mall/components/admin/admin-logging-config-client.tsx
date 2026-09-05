"use client";

import { useCallback, useEffect, useState } from "react";

type Config = {
  modelDailyLimit: number;
  modelDailyLimitOverrides: Record<string, number>;
  vendorDirectBlockHosts: string[];
  usageReconEnabled: boolean;
  usageReconIntervalMin: number;
  source: "platform" | "env-fallback";
};

function flashClass(kind: "ok" | "error"): string {
  return kind === "ok"
    ? "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
    : "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive";
}

export function AdminLoggingConfigClient() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // 表单态
  const [limit, setLimit] = useState("300");
  const [overrides, setOverrides] = useState("{}");
  const [blockHosts, setBlockHosts] = useState("");
  const [reconEnabled, setReconEnabled] = useState(true);
  const [reconInterval, setReconInterval] = useState("30");

  const load = useCallback(async () => {
    setBusy(true);
    setFlash(null);
    try {
      const r = await fetch("/api/admin/logging-config");
      const j = (await r.json()) as { config?: Config; error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      const c = j.config!;
      setCfg(c);
      setLimit(String(c.modelDailyLimit));
      setOverrides(JSON.stringify(c.modelDailyLimitOverrides, null, 2));
      setBlockHosts(c.vendorDirectBlockHosts.join(", "));
      setReconEnabled(c.usageReconEnabled);
      setReconInterval(String(c.usageReconIntervalMin));
    } catch (e) {
      setFlash({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setFlash(null);
    try {
      let overridesObj: Record<string, number> = {};
      const raw = overrides.trim();
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error("按模型覆盖须为 JSON 对象");
        }
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          const n = Number(v);
          if (!k.trim() || !Number.isFinite(n) || n < 0) {
            throw new Error(`覆盖项无效：${k}=${String(v)}（须为非负整数）`);
          }
          overridesObj[k.trim()] = Math.floor(n);
        }
      }

      const body = {
        modelDailyLimit: Math.max(0, Math.floor(Number(limit) || 0)),
        modelDailyLimitOverrides: overridesObj,
        vendorDirectBlockHosts: blockHosts
          .split(/[,\n]/)
          .map((h) => h.trim())
          .filter(Boolean),
        usageReconEnabled: reconEnabled,
        usageReconIntervalMin: Math.max(1, Math.floor(Number(reconInterval) || 30)),
      };

      const r = await fetch("/api/admin/logging-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { config?: Config; error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setCfg(j.config!);
      setFlash({ kind: "ok", text: "已保存（约 30s 内生效，无需重启）" });
    } catch (e) {
      setFlash({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {flash ? <p className={flashClass(flash.kind)}>{flash.text}</p> : null}

      {cfg ? (
        <p className="text-xs text-muted-foreground">
          当前来源：{cfg.source === "platform" ? "管理后台（PlatformConfig）" : "环境变量回退"}
        </p>
      ) : null}

      <section className="rounded-xl border border-secondary p-5">
        <h2 className="text-lg font-semibold">单模型日调用上限（保险丝）</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          同一模型当日（CST）经 Gateway 调用达到上限即 <strong>429 熔断</strong> 并落错误日志。
          计数含失败。填 <code>0</code> 关闭整个保险丝。
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">默认上限（次/模型/日）</span>
            <input
              type="number"
              min={0}
              className="rounded-md border border-secondary bg-background px-3 py-2"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </label>
        </div>
        <label className="mt-4 flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">
            按模型覆盖（JSON；<code>0</code> = 该模型不限）
          </span>
          <textarea
            rows={4}
            className="rounded-md border border-secondary bg-background px-3 py-2 font-mono text-xs"
            placeholder='{"deepseek-v4-flash":1000,"kling-x":0}'
            value={overrides}
            onChange={(e) => setOverrides(e.target.value)}
          />
        </label>
      </section>

      <section className="rounded-xl border border-secondary p-5">
        <h2 className="text-lg font-semibold">厂商直连出口审计 / 阻断</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          业务层直连已知厂商域名即落 <code>VENDOR_DIRECT_EGRESS</code>。
          下方名单中的 host 会被 <strong>硬阻断</strong>（审计 + 控制台报错）；留空 = 仅审计。
        </p>
        <label className="mt-4 flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">阻断名单（逗号 / 换行分隔）</span>
          <textarea
            rows={2}
            className="rounded-md border border-secondary bg-background px-3 py-2 font-mono text-xs"
            placeholder="api.deepseek.com, api.moonshot.cn"
            value={blockHosts}
            onChange={(e) => setBlockHosts(e.target.value)}
          />
        </label>
      </section>

      <section className="rounded-xl border border-secondary p-5">
        <h2 className="text-lg font-semibold">常驻用量对账</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          每日 CST 01:00 后审计昨日「平台任务 vs Gateway」差异，异常落{" "}
          <code>USAGE_RECON_MISMATCH</code>。
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={reconEnabled}
              onChange={(e) => setReconEnabled(e.target.checked)}
            />
            启用常驻对账
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">扫描间隔（分钟）</span>
            <input
              type="number"
              min={1}
              className="rounded-md border border-secondary bg-background px-3 py-2"
              value={reconInterval}
              onChange={(e) => setReconInterval(e.target.value)}
            />
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "保存中…" : "保存配置"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded-md border border-secondary px-4 py-2 text-sm"
        >
          重新加载
        </button>
      </div>
    </div>
  );
}
