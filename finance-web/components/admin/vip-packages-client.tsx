"use client";

import { useCallback, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell } from "@/components/finance-page-shell";
import { financeApiPost } from "@/lib/finance-viewer";

type Scheme = {
  videoFraction: number;
  pricePerCreditYuan: number;
  totalCredits: number;
  generalCredits: number;
  videoCredits: number;
  actualMargin: number;
  faceValueYuan: number;
  costYuan: number;
};
type Quote = {
  amountYuan: number;
  targetMargin: number;
  meetsMinimum: boolean;
  schemeGeneralHeavy: Scheme;
  schemeVideoHeavy: Scheme;
};

const inputCls =
  "w-full rounded border border-[#d9d9d9] px-2 py-1 text-sm focus:border-[#1890ff] focus:outline-none";

function yuan(n: number): string {
  return `¥${n.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function credits(n: number): string {
  return n.toLocaleString("zh-CN");
}

export function VipPackagesClient() {
  const base = useBookMallBaseUrl();

  const [amount, setAmount] = useState("200000");
  const [marginPct, setMarginPct] = useState("50");
  const [generalHeavyPct, setGeneralHeavyPct] = useState("15");
  const [videoHeavyPct, setVideoHeavyPct] = useState("40");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 开通表单
  const [ownerUserId, setOwnerUserId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [seats, setSeats] = useState("3");
  const [chosen, setChosen] = useState<"general_heavy" | "video_heavy">("general_heavy");
  const [provisioning, setProvisioning] = useState(false);
  const [provisionMsg, setProvisionMsg] = useState<string | null>(null);

  const runQuote = useCallback(async () => {
    if (!base) return;
    setMsg(null);
    setLoading(true);
    const r = await financeApiPost<{ quote: Quote }>(base, "/api/finance/admin/vip-packages/quote", {
      amountYuan: Number(amount),
      targetMargin: Number(marginPct) / 100,
      generalHeavyVideoFraction: Number(generalHeavyPct) / 100,
      videoHeavyVideoFraction: Number(videoHeavyPct) / 100,
    });
    setLoading(false);
    if (r.ok) {
      setQuote(r.data.quote);
      if (!r.data.quote.meetsMinimum) setMsg("提示：低于 VIP 起订金额 ¥100,000（仍可测算，但开通会被拒绝）。");
    } else {
      setMsg(r.error);
    }
  }, [base, amount, marginPct, generalHeavyPct, videoHeavyPct]);

  const provision = useCallback(async () => {
    if (!base || !quote) return;
    setProvisionMsg(null);
    if (!ownerUserId.trim()) {
      setProvisionMsg("请填写客户 ownerUserId");
      return;
    }
    setProvisioning(true);
    const videoFraction =
      chosen === "video_heavy"
        ? quote.schemeVideoHeavy.videoFraction
        : quote.schemeGeneralHeavy.videoFraction;
    const r = await financeApiPost<{ ok: boolean; tenantId: string; error?: string }>(
      base,
      "/api/finance/admin/vip-packages/provision",
      {
        ownerUserId: ownerUserId.trim(),
        teamName: teamName.trim() || "VIP 团队",
        amountYuan: Number(amount),
        targetMargin: Number(marginPct) / 100,
        scheme: chosen,
        videoFraction,
        seats: Number(seats),
      },
    );
    setProvisioning(false);
    if (r.ok) {
      setProvisionMsg(`已开通 VIP 团队，tenantId=${r.data.tenantId}`);
    } else {
      setProvisionMsg(r.error);
    }
  }, [base, quote, ownerUserId, teamName, amount, marginPct, chosen, seats]);

  const renderScheme = (title: string, s: Scheme, kind: "general_heavy" | "video_heavy") => (
    <label
      className={`block cursor-pointer rounded border p-3 ${
        chosen === kind ? "border-[#1890ff] bg-[#f0f6ff]" : "border-[#e8e8e8] bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-[#262626]">
          <input
            type="radio"
            name="vip-scheme"
            checked={chosen === kind}
            onChange={() => setChosen(kind)}
            className="mr-2"
          />
          {title}
        </span>
        <span className="text-xs text-[#8c8c8c]">视频占比 {(s.videoFraction * 100).toFixed(0)}%</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 text-sm text-[#262626]">
        <div>总积分：<b>{credits(s.totalCredits)}</b></div>
        <div>实际毛利：<b>{(s.actualMargin * 100).toFixed(1)}%</b></div>
        <div>通用：{credits(s.generalCredits)}</div>
        <div>视频：{credits(s.videoCredits)}</div>
        <div>每积分售价：¥{s.pricePerCreditYuan.toFixed(5)}</div>
        <div>锚定面值：{yuan(s.faceValueYuan)}</div>
        <div className="col-span-2 text-xs text-[#8c8c8c]">平台成本：{yuan(s.costYuan)}</div>
      </div>
    </label>
  );

  return (
    <FinancePageShell>
      <h1 className="text-lg font-medium text-[#262626]">VIP 大额套餐 · 测算与开通</h1>
      <p className="text-xs text-[#8c8c8c]">
        大额预充客户（起订 ¥100,000）。输入充值金额与目标毛利，生成「通用多 / 视频多」两方案；毛利由调总积分恒定保证。
        口径（保守满额消耗）：通用 ¥0.016/积分、视频 ¥0.0267/积分。VIP 积分一次性发放、长期有效、不清零。
      </p>

      <div className="rounded border border-[#e8e8e8] bg-[#fafcff] p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[#595959]">充值金额（元）</span>
            <input className={inputCls} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[#595959]">目标毛利（%）</span>
            <input className={inputCls} type="number" min={0} max={99} value={marginPct} onChange={(e) => setMarginPct(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[#595959]">通用多方案 · 视频占比（%）</span>
            <input className={inputCls} type="number" min={0} max={100} value={generalHeavyPct} onChange={(e) => setGeneralHeavyPct(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[#595959]">视频多方案 · 视频占比（%）</span>
            <input className={inputCls} type="number" min={0} max={100} value={videoHeavyPct} onChange={(e) => setVideoHeavyPct(e.target.value)} />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void runQuote()}
          disabled={loading}
          className="mt-3 rounded bg-[#1890ff] px-4 py-1.5 text-sm text-white hover:bg-[#40a9ff] disabled:opacity-50"
        >
          {loading ? "测算中…" : "测算"}
        </button>
        {msg ? <div className="mt-2 text-sm text-[#fa8c16]">{msg}</div> : null}
      </div>

      {quote ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {renderScheme("方案 A · 通用多", quote.schemeGeneralHeavy, "general_heavy")}
            {renderScheme("方案 B · 视频多", quote.schemeVideoHeavy, "video_heavy")}
          </div>

          <div className="rounded border border-[#e8e8e8] bg-white p-4">
            <h2 className="text-sm font-medium text-[#262626]">开通 VIP 团队（选定方案：{chosen === "video_heavy" ? "视频多" : "通用多"}）</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs text-[#595959]">客户 ownerUserId</span>
                <input className={inputCls} value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} placeholder="Book 用户 id" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-[#595959]">团队名称</span>
                <input className={inputCls} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="VIP 团队" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-[#595959]">席位数</span>
                <input className={inputCls} type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void provision()}
              disabled={provisioning}
              className="mt-3 rounded bg-[#52c41a] px-4 py-1.5 text-sm text-white hover:bg-[#73d13d] disabled:opacity-50"
            >
              {provisioning ? "开通中…" : "开通 VIP 团队并发放积分"}
            </button>
            {provisionMsg ? <div className="mt-2 text-sm text-[#1890ff]">{provisionMsg}</div> : null}
          </div>
        </>
      ) : null}
    </FinancePageShell>
  );
}
