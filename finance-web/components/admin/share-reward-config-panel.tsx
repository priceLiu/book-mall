"use client";

import { useCallback, useEffect, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";

const inputCls =
  "w-full rounded border border-[#d9d9d9] px-2 py-1.5 text-sm focus:border-[#1890ff] focus:outline-none";

type ShareRewardConfig = {
  referralRewardCredits: number;
  workflowShareRewardCredits: number;
  shareRewardCreditsExpireDays: number;
  shareRewardDailyCapPerReferrer: number;
};

export function ShareRewardConfigPanel() {
  const base = useBookMallBaseUrl();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cfg, setCfg] = useState<ShareRewardConfig>({
    referralRewardCredits: 20,
    workflowShareRewardCredits: 40,
    shareRewardCreditsExpireDays: 90,
    shareRewardDailyCapPerReferrer: 0,
  });

  const reload = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    const r = await financeApiFetch<{ config: ShareRewardConfig }>(
      base,
      "/api/finance/admin/share-reward-config",
    );
    if (r.ok) setCfg(r.data.config);
    setLoading(false);
  }, [base]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save() {
    if (!base) return;
    setSaving(true);
    setMsg(null);
    const r = await financeApiPost<{ ok: boolean; error?: string }>(
      base,
      "/api/finance/admin/share-reward-config",
      cfg,
    );
    setSaving(false);
    if (!r.ok || !r.data.ok) setMsg(r.ok ? (r.data.error ?? "保存失败") : r.error);
    else setMsg("分享奖励配置已保存");
  }

  if (loading) return <FinancePageState>加载分享配置…</FinancePageState>;

  return (
    <section className="rounded-lg border border-[#e8e8e8] bg-white p-4">
      <h2 className="text-base font-semibold text-[#262626]">分享规则 2.0 · 积分奖励</h2>
      <p className="mt-1 text-xs text-[#8c8c8c]">
        邀请：注册 + 好友首笔订阅/充值 → 邀请奖励；工作流：好友首次扣积分生成 + 首笔订阅/充值 →
        工作流奖励。先到先得，同一好友仅发一笔。现金返佣已退役。
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs text-[#595959]">
          邀请奖励（积分）
          <input
            type="number"
            min={0}
            max={1000}
            className={`${inputCls} mt-1`}
            value={cfg.referralRewardCredits}
            onChange={(e) =>
              setCfg((c) => ({ ...c, referralRewardCredits: Number(e.target.value) }))
            }
          />
        </label>
        <label className="block text-xs text-[#595959]">
          工作流奖励（积分）
          <input
            type="number"
            min={0}
            max={1000}
            className={`${inputCls} mt-1`}
            value={cfg.workflowShareRewardCredits}
            onChange={(e) =>
              setCfg((c) => ({ ...c, workflowShareRewardCredits: Number(e.target.value) }))
            }
          />
        </label>
        <label className="block text-xs text-[#595959]">
          奖励有效天数
          <input
            type="number"
            min={1}
            max={365}
            className={`${inputCls} mt-1`}
            value={cfg.shareRewardCreditsExpireDays}
            onChange={(e) =>
              setCfg((c) => ({ ...c, shareRewardCreditsExpireDays: Number(e.target.value) }))
            }
          />
        </label>
        <label className="block text-xs text-[#595959]">
          分享人日上限（0=不限）
          <input
            type="number"
            min={0}
            className={`${inputCls} mt-1`}
            value={cfg.shareRewardDailyCapPerReferrer}
            onChange={(e) =>
              setCfg((c) => ({
                ...c,
                shareRewardDailyCapPerReferrer: Number(e.target.value),
              }))
            }
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded bg-[#1890ff] px-4 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存配置"}
        </button>
        {msg ? <span className="text-sm text-[#52c41a]">{msg}</span> : null}
      </div>
    </section>
  );
}
