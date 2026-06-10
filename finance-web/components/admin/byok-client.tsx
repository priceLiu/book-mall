"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";

type ByokConfig = {
  id: string;
  scopeKey: string;
  label: string;
  techServiceFeeYuan: number;
  minSeats: number | null;
  interval: string;
  note: string | null;
  active: boolean;
};

type ByokQuota = {
  id: string;
  scopeKey: string;
  taskKind: string;
  label: string;
  monthlyIncluded: number;
  overageCredits: number;
  overageYuan: number;
  active: boolean;
};

type ResourceRate = {
  resourceType: string;
  coefficientYuan: number;
  unitLabel: string;
};

type SimulationRow = {
  scopeKey: string;
  label: string;
  scenario: string;
  description: string;
  techFeeYuan: number;
  overageCredits: number;
  overageRevenueYuan: number;
  platformCostYuan: number;
  profitYuan: number;
  marginRate: number;
};

type Payload = {
  periodKey: string;
  standards: {
    anchorYuan: number;
    lightPack: { label: string; credits: number; priceYuan: number };
    overageRationale: { taskKind: string; credits: number; yuan: number; note: string }[];
  };
  configs: ByokConfig[];
  quotas: ByokQuota[];
  rates: ResourceRate[];
  observed: {
    gatewayTaskCount: number;
    overageCreditsTotal: number;
    vendorCostYuan: number;
    resourceFeeYuan: number;
    taskByKind: Record<string, number>;
    note: string;
  };
  ownerUsage: Array<{
    ownerType: string;
    ownerId: string;
    scopeKey: string;
    seats: number;
    label: string;
    audience: string;
    balanceCredits: number;
    totalOverageCredits: number;
    tasks: Array<{
      taskKind: string;
      label: string;
      includedUsed: number;
      overageUsed: number;
      overageCredits: number;
      quota: number;
    }>;
  }>;
  memberActorUsage: Array<{
    actorBookUserId: string;
    tenantId: string | null;
    userName: string | null;
    userEmail: string | null;
    count: number;
    overageCredits: number;
  }>;
  simulationScenarios: SimulationRow[];
};

const RESOURCE_LABEL: Record<string, string> = {
  OSS_GB_MONTH: "云存储 OSS",
  EGRESS_GB: "出网流量",
  TASK_COUNT: "任务调度",
};

const TASK_KIND_LABEL: Record<string, string> = {
  TEXT_TO_IMAGE: "文生图",
  IMAGE_TO_VIDEO: "图生视频",
  VIDEO_TO_VIDEO: "视频生视频",
};

const inputCls =
  "w-full rounded border border-[#d9d9d9] px-2 py-1.5 text-sm focus:border-[#1890ff] focus:outline-none";

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function yuan(n: number) {
  return `¥${n.toFixed(2)}`;
}

export function ByokClient() {
  const base = useBookMallBaseUrl();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [configDraft, setConfigDraft] = useState<Record<string, { fee: string; minSeats: string }>>({});
  const [quotaDraft, setQuotaDraft] = useState<
    Record<string, { monthlyIncluded: string; overageCredits: string }>
  >({});
  const [rateDraft, setRateDraft] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    const r = await financeApiFetch<Payload>(base, "/api/finance/admin/byok");
    if (r.ok) {
      setData(r.data);
      const cd: Record<string, { fee: string; minSeats: string }> = {};
      for (const c of r.data.configs) {
        cd[c.id] = {
          fee: String(c.techServiceFeeYuan),
          minSeats: c.minSeats != null ? String(c.minSeats) : "",
        };
      }
      setConfigDraft(cd);
      const qd: Record<string, { monthlyIncluded: string; overageCredits: string }> = {};
      for (const q of r.data.quotas) {
        qd[q.id] = {
          monthlyIncluded: String(q.monthlyIncluded),
          overageCredits: String(q.overageCredits),
        };
      }
      setQuotaDraft(qd);
      const rd: Record<string, string> = {};
      for (const rt of r.data.rates) rd[rt.resourceType] = String(rt.coefficientYuan);
      setRateDraft(rd);
    } else setError(r.error);
    setLoading(false);
  }, [base]);

  useEffect(() => {
    reload();
  }, [reload]);

  const quotasByScope = useMemo(() => {
    if (!data) return {};
    return data.quotas.reduce<Record<string, ByokQuota[]>>((acc, q) => {
      (acc[q.scopeKey] ||= []).push(q);
      return acc;
    }, {});
  }, [data]);

  async function saveConfig(cfg: ByokConfig) {
    if (!base) return;
    setSaving(true);
    const draft = configDraft[cfg.id];
    const r = await financeApiPost<{ ok: boolean; error?: string }>(base, "/api/finance/admin/byok", {
      action: "upsertConfig",
      id: cfg.id,
      scopeKey: cfg.scopeKey,
      label: cfg.label,
      techServiceFeeYuan: Number(draft?.fee ?? cfg.techServiceFeeYuan),
      minSeats: draft?.minSeats ? Number(draft.minSeats) : null,
      interval: cfg.interval,
      note: cfg.note,
      active: true,
    });
    setSaving(false);
    if (!r.ok || !r.data.ok) setMsg(r.ok ? (r.data.error ?? "保存失败") : r.error);
    else {
      setMsg(`${cfg.label} 月费已保存`);
      reload();
    }
  }

  async function saveQuota(q: ByokQuota) {
    if (!base) return;
    setSaving(true);
    const draft = quotaDraft[q.id];
    const r = await financeApiPost<{ ok: boolean; error?: string }>(base, "/api/finance/admin/byok", {
      action: "saveQuota",
      id: q.id,
      scopeKey: q.scopeKey,
      taskKind: q.taskKind,
      label: q.label,
      monthlyIncluded: Number(draft?.monthlyIncluded ?? q.monthlyIncluded),
      overageCredits: Number(draft?.overageCredits ?? q.overageCredits),
      active: true,
    });
    setSaving(false);
    if (!r.ok || !r.data.ok) setMsg(r.ok ? (r.data.error ?? "保存失败") : r.error);
    else {
      setMsg(`${q.label} 额度已保存`);
      reload();
    }
  }

  async function saveRate(resourceType: string) {
    if (!base) return;
    setSaving(true);
    const r = await financeApiPost<{ ok: boolean; error?: string }>(base, "/api/finance/admin/byok", {
      action: "saveRate",
      resourceType,
      coefficientYuan: Number(rateDraft[resourceType] ?? 0),
      active: true,
    });
    setSaving(false);
    if (!r.ok || !r.data.ok) setMsg(r.ok ? (r.data.error ?? "保存失败") : r.error);
    else {
      setMsg(`${RESOURCE_LABEL[resourceType] ?? resourceType} 系数已保存`);
      reload();
    }
  }

  if (loading) return <FinancePageState>加载中…</FinancePageState>;
  if (error) return <FinancePageState variant="error">{error}</FinancePageState>;
  if (!data) return null;

  return (
    <FinancePageShell>
      <header>
        <h1 className="text-lg font-medium text-[#262626]">BYOK 定价与核算</h1>
        <p className="mt-1 text-sm text-[#595959]">
          自带 Key 仅两档：<strong>个人 ¥39/月</strong>、<strong>团队 ¥29/席/月（3 席起）</strong>。
          套餐内含任务额度，超出后从<strong>轻量包</strong>（{data.standards.lightPack.credits} 积分 /{" "}
          {yuan(data.standards.lightPack.priceYuan)}）按次扣固定积分。
        </p>
      </header>

      {msg ? <p className="rounded bg-[#e6f7ff] px-3 py-2 text-sm text-[#1890ff]">{msg}</p> : null}

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="text-sm font-medium">超额扣分标准（测算依据）</h2>
        <p className="mt-1 text-xs text-[#8c8c8c]">
          锚定 {data.standards.anchorYuan} 元/积分；以下为平台基础设施成本（不含用户自付厂商费）
        </p>
        <table className="mt-3 w-full text-sm">
          <thead className="bg-[#fafafa] text-xs text-[#8c8c8c]">
            <tr>
              <th className="px-3 py-2 text-left">任务</th>
              <th className="px-3 py-2 text-right">超额扣分</th>
              <th className="px-3 py-2 text-right">折合金额</th>
              <th className="px-3 py-2 text-left">说明</th>
            </tr>
          </thead>
          <tbody>
            {data.standards.overageRationale.map((row) => (
              <tr key={row.taskKind} className="border-t">
                <td className="px-3 py-2">{TASK_KIND_LABEL[row.taskKind] ?? row.taskKind}</td>
                <td className="px-3 py-2 text-right">{row.credits} 积分/次</td>
                <td className="px-3 py-2 text-right">{yuan(row.yuan)}</td>
                <td className="px-3 py-2 text-xs text-[#595959]">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {data.configs.map((cfg) => (
        <section key={cfg.id} className="rounded border border-[#e8e8e8] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">{cfg.label}</h2>
              <p className="mt-1 text-xs text-[#8c8c8c]">{cfg.note}</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-[#8c8c8c]">
                月费（元）
                <input
                  type="number"
                  step="0.01"
                  className={`${inputCls} mt-1 w-28`}
                  value={configDraft[cfg.id]?.fee ?? ""}
                  onChange={(e) =>
                    setConfigDraft({ ...configDraft, [cfg.id]: { ...configDraft[cfg.id], fee: e.target.value } })
                  }
                />
              </label>
              {cfg.scopeKey === "team-seat" ? (
                <label className="text-xs text-[#8c8c8c]">
                  最低席位数
                  <input
                    type="number"
                    className={`${inputCls} mt-1 w-20`}
                    value={configDraft[cfg.id]?.minSeats ?? ""}
                    onChange={(e) =>
                      setConfigDraft({
                        ...configDraft,
                        [cfg.id]: { ...configDraft[cfg.id], minSeats: e.target.value },
                      })
                    }
                  />
                </label>
              ) : null}
              <button
                type="button"
                disabled={saving}
                onClick={() => saveConfig(cfg)}
                className="rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                保存月费
              </button>
            </div>
          </div>

          <table className="mt-4 w-full text-sm">
            <thead className="bg-[#fafafa] text-xs text-[#8c8c8c]">
              <tr>
                <th className="px-3 py-2 text-left">任务类型</th>
                <th className="px-3 py-2 text-right">套餐内额度/月{cfg.scopeKey === "team-seat" ? "/席" : ""}</th>
                <th className="px-3 py-2 text-right">超额扣分</th>
                <th className="px-3 py-2 text-right">超额单价</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(quotasByScope[cfg.scopeKey] ?? []).map((q) => (
                <tr key={q.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{q.label}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      className={`${inputCls} w-24 text-right`}
                      value={quotaDraft[q.id]?.monthlyIncluded ?? ""}
                      onChange={(e) =>
                        setQuotaDraft({
                          ...quotaDraft,
                          [q.id]: { ...quotaDraft[q.id], monthlyIncluded: e.target.value },
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      className={`${inputCls} w-24 text-right`}
                      value={quotaDraft[q.id]?.overageCredits ?? ""}
                      onChange={(e) =>
                        setQuotaDraft({
                          ...quotaDraft,
                          [q.id]: { ...quotaDraft[q.id], overageCredits: e.target.value },
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-[#8c8c8c]">{yuan(q.overageYuan)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => saveQuota(q)}
                      className="text-xs text-[#1890ff] hover:underline disabled:opacity-50"
                    >
                      保存
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="text-sm font-medium">财务测算（{data.periodKey}）</h2>
        <p className="mt-1 text-xs text-[#8c8c8c]">
          平台收入 = 技术服务费 + 超额轻量包收入；平台成本 = 基础设施（不含用户付厂商）
        </p>
        <table className="mt-3 w-full text-sm">
          <thead className="bg-[#fafafa] text-xs text-[#8c8c8c]">
            <tr>
              <th className="px-3 py-2 text-left">档位</th>
              <th className="px-3 py-2 text-left">场景</th>
              <th className="px-3 py-2 text-right">月费收入</th>
              <th className="px-3 py-2 text-right">超额积分</th>
              <th className="px-3 py-2 text-right">超额收入</th>
              <th className="px-3 py-2 text-right">平台成本</th>
              <th className="px-3 py-2 text-right">利润</th>
              <th className="px-3 py-2 text-right">毛利率</th>
            </tr>
          </thead>
          <tbody>
            {data.simulationScenarios.map((row) => (
              <tr key={`${row.scopeKey}:${row.scenario}`} className="border-t align-top">
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2">
                  <div>{row.scenario}</div>
                  <div className="text-xs text-[#8c8c8c]">{row.description}</div>
                </td>
                <td className="px-3 py-2 text-right">{yuan(row.techFeeYuan)}</td>
                <td className="px-3 py-2 text-right">{row.overageCredits}</td>
                <td className="px-3 py-2 text-right">{yuan(row.overageRevenueYuan)}</td>
                <td className="px-3 py-2 text-right">{yuan(row.platformCostYuan)}</td>
                <td className="px-3 py-2 text-right text-[#389e0d]">{yuan(row.profitYuan)}</td>
                <td className="px-3 py-2 text-right">{pct(row.marginRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="text-sm font-medium">用量与积分报表（{data.periodKey}）</h2>
        <p className="mt-1 text-xs text-[#8c8c8c]">
          按个人/团队账户汇总：套餐内用量、超额次数、已扣积分、当前轻量包余额。
        </p>
        {data.ownerUsage.length === 0 ? (
          <p className="mt-3 text-sm text-[#8c8c8c]">本月尚无 BYOK 用量记录（成功生成后会自动入账）。</p>
        ) : (
          <div className="mt-3 space-y-3">
            {data.ownerUsage.map((o) => (
              <div key={`${o.ownerType}:${o.ownerId}`} className="rounded border border-[#f0f0f0] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="rounded bg-[#e6f7ff] px-2 py-0.5 text-xs text-[#1890ff]">{o.audience}</span>
                    <span className="ml-2 text-sm font-medium">{o.label}</span>
                    {o.scopeKey === "team-seat" ? (
                      <span className="ml-2 text-xs text-[#8c8c8c]">{o.seats} 席</span>
                    ) : null}
                  </div>
                  <div className="text-sm">
                    轻量包余额 <strong>{o.balanceCredits.toLocaleString()}</strong> 积分
                    {o.totalOverageCredits > 0 ? (
                      <span className="ml-3 text-[#cf1322]">本月超额已扣 {o.totalOverageCredits} 积分</span>
                    ) : (
                      <span className="ml-3 text-[#389e0d]">本月无超额扣分</span>
                    )}
                  </div>
                </div>
                <table className="mt-2 w-full text-xs">
                  <thead className="text-[#8c8c8c]">
                    <tr>
                      <th className="py-1 text-left">任务</th>
                      <th className="py-1 text-right">套餐内已用</th>
                      <th className="py-1 text-right">超额次数</th>
                      <th className="py-1 text-right">超额扣分</th>
                      <th className="py-1 text-right">月额度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.tasks.map((t) => (
                      <tr key={t.taskKind} className="border-t">
                        <td className="py-1">{t.label}</td>
                        <td className="py-1 text-right">{t.includedUsed}</td>
                        <td className="py-1 text-right">{t.overageUsed}</td>
                        <td className="py-1 text-right">{t.overageCredits}</td>
                        <td className="py-1 text-right">
                          {t.quota}
                          {o.scopeKey === "team-seat" ? `×${o.seats}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="text-sm font-medium">成员超额钻取（{data.periodKey}）</h2>
        <p className="mt-1 text-xs text-[#8c8c8c]">
          按 Book 用户 ID（actorBookUserId）聚合 BYOK 超额扣分与成功请求次数。
        </p>
        {data.memberActorUsage.length === 0 ? (
          <p className="mt-3 text-sm text-[#8c8c8c]">暂无成员维度数据。</p>
        ) : (
          <table className="mt-3 w-full text-xs">
            <thead className="bg-[#fafafa] text-[#8c8c8c]">
              <tr>
                <th className="px-2 py-2 text-left">成员</th>
                <th className="px-2 py-2 text-left">Book 用户 ID</th>
                <th className="px-2 py-2 text-left">团队 ID</th>
                <th className="px-2 py-2 text-right">请求次数</th>
                <th className="px-2 py-2 text-right">超额扣分</th>
              </tr>
            </thead>
            <tbody>
              {data.memberActorUsage.map((m) => (
                <tr key={`${m.tenantId ?? "p"}:${m.actorBookUserId}`} className="border-t">
                  <td className="px-2 py-1.5">{m.userName ?? m.userEmail ?? "—"}</td>
                  <td className="px-2 py-1.5 font-mono">{m.actorBookUserId}</td>
                  <td className="px-2 py-1.5 font-mono">{m.tenantId ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">{m.count}</td>
                  <td className="px-2 py-1.5 text-right">{m.overageCredits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="text-sm font-medium">实账观测（{data.periodKey}）</h2>
        <p className="mt-1 text-xs text-[#8c8c8c]">{data.observed.note}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="BYOK 成功请求" value={String(data.observed.gatewayTaskCount)} />
          <Metric label="超额扣分合计" value={`${data.observed.overageCreditsTotal ?? 0} 积分`} />
          <Metric label="用户厂商成本（观测）" value={yuan(data.observed.vendorCostYuan)} />
          <Metric label="资源计量费" value={yuan(data.observed.resourceFeeYuan)} />
          <Metric
            label="文生图 / 视频类"
            value={`${data.observed.taskByKind.TEXT_TO_IMAGE ?? 0} / ${data.observed.taskByKind.IMAGE_TO_VIDEO ?? 0}`}
          />
        </div>
      </section>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-2 text-sm font-medium">资源系数（超额外另计）</h2>
        <div className="space-y-3">
          {data.rates.map((r) => (
            <div key={r.resourceType} className="flex flex-wrap items-center gap-3">
              <span className="w-32 text-sm">{RESOURCE_LABEL[r.resourceType] ?? r.resourceType}</span>
              <input
                type="number"
                step="0.0001"
                className={`${inputCls} w-32`}
                value={rateDraft[r.resourceType] ?? ""}
                onChange={(e) => setRateDraft({ ...rateDraft, [r.resourceType]: e.target.value })}
              />
              <span className="text-xs text-[#8c8c8c]">{r.unitLabel}</span>
              <button
                type="button"
                disabled={saving}
                onClick={() => saveRate(r.resourceType)}
                className="rounded border border-[#d9d9d9] px-2 py-1 text-sm hover:bg-[#fafafa]"
              >
                保存
              </button>
            </div>
          ))}
        </div>
      </section>
    </FinancePageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-[#fafafa] px-3 py-2">
      <div className="text-xs text-[#8c8c8c]">{label}</div>
      <div className="mt-1 text-base font-medium text-[#262626]">{value}</div>
    </div>
  );
}
