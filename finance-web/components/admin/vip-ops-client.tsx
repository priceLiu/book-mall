"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell } from "@/components/finance-page-shell";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";
import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

const inputCls =
  "w-full rounded border border-[#d9d9d9] px-2 py-1 text-sm focus:border-[#1890ff] focus:outline-none";

const AMOUNT_TIERS = [100_000, 200_000, 500_000] as const;

const DOC_KIND_LABEL: Record<string, string> = {
  CONTRACT: "服务合同",
  PAYMENT_PROOF: "支付凭证",
  INVOICE: "发票",
  OTHER: "其他",
};

type Scheme = {
  videoFraction: number;
  totalCredits: number;
  generalCredits: number;
  videoCredits: number;
  actualMargin: number;
  faceValueYuan: number;
};
type Quote = {
  amountYuan: number;
  targetMargin: number;
  meetsMinimum: boolean;
  schemeGeneralHeavy: Scheme;
  schemeVideoHeavy: Scheme;
};

type SeatRow = {
  label: string;
  phone: string;
  role: "OWNER" | "MEMBER";
  generalCredits: number;
  videoCredits: number;
  isChief?: boolean;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  vipTenantId: string | null;
  vipTeamName: string | null;
};

type TeamRow = {
  tenantId: string;
  name: string;
  seatLimit: number;
  activeMembers: number;
  generalCredits: number;
  videoCredits: number;
  owner: { id: string; name: string | null; phone: string | null };
};

type TenantDetail = {
  tenant: {
    id: string;
    name: string;
    seatLimit: number;
    perSeatCapCredits: number | null;
    maxConcurrency: number;
    packageLevel: string | null;
  };
  owner: { id: string; name: string | null; phone: string | null; email: string | null } | null;
  credits: { general: number; video: number; perSeatCapCredits: number | null };
  members: {
    id: string;
    userId: string;
    role: string;
    monthlyCapCredits: number | null;
    user: { name: string | null; phone: string | null };
  }[];
  documents: {
    id: string;
    kind: string;
    filename: string;
    ossUrl: string;
    note: string | null;
    createdAt: string;
  }[];
  creditLots: {
    pool: string;
    source: string;
    remainingCredits: number;
    expiresAt: string | null;
  }[];
  invites: {
    id: string;
    phone: string;
    role: string;
    status: string;
    plannedGeneralCredits: number | null;
    plannedVideoCredits: number | null;
    expiresAt: string;
    createdAt: string;
  }[];
};

function credits(n: number) {
  return n.toLocaleString("zh-CN");
}

function formatPowerRef(yuan: number) {
  return `算力市场价参考约 ${yuan.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 元`;
}

function autoSeatRows(scheme: Scheme, seats: number, ownerPhone: string): SeatRow[] {
  const s = Math.max(1, seats);
  const perG = Math.floor(scheme.generalCredits / s);
  const perV = Math.floor(scheme.videoCredits / s);
  const remG = scheme.generalCredits - perG * s;
  const remV = scheme.videoCredits - perV * s;
  return Array.from({ length: s }, (_, i) => {
    const isChief = i === 0;
    return {
      label: isChief ? "首席席（含余数）" : `席位 ${i + 1}`,
      phone: isChief ? ownerPhone : "",
      role: isChief ? "OWNER" : "MEMBER",
      generalCredits: perG + (isChief ? remG : 0),
      videoCredits: perV + (isChief ? remV : 0),
      isChief,
    };
  });
}

function sumSeatRows(rows: SeatRow[]) {
  return rows.reduce(
    (acc, r) => ({
      general: acc.general + Math.max(0, Math.round(r.generalCredits)),
      video: acc.video + Math.max(0, Math.round(r.videoCredits)),
    }),
    { general: 0, video: 0 },
  );
}

export function VipOpsClient() {
  const base = useBookMallBaseUrl();

  // —— 客户查找 ——
  const [lookupQ, setLookupQ] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);

  // —— VIP 团队列表 ——
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [detailMsg, setDetailMsg] = useState<string | null>(null);

  // —— 测算开通 ——
  const [amountTier, setAmountTier] = useState<number>(200_000);
  const [marginPct, setMarginPct] = useState("50");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [chosen, setChosen] = useState<"general_heavy" | "video_heavy">("general_heavy");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [seatCount, setSeatCount] = useState("5");
  const [allocationMode, setAllocationMode] = useState<"auto" | "manual">("auto");
  const [seatRows, setSeatRows] = useState<SeatRow[]>([]);
  const [opsMsg, setOpsMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // —— 席位/积分运维 ——
  const [cfgSeats, setCfgSeats] = useState("");
  const [cfgCap, setCfgCap] = useState("");
  const [grantGeneral, setGrantGeneral] = useState("");
  const [grantVideo, setGrantVideo] = useState("");
  const [adjustCredits, setAdjustCredits] = useState("");
  const [adjustPool, setAdjustPool] = useState<"GENERAL" | "VIDEO">("GENERAL");

  // —— 附件 ——
  const [docKind, setDocKind] = useState("CONTRACT");
  const [docNote, setDocNote] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);

  const loadTeams = useCallback(async () => {
    if (!base) return;
    const r = await financeApiFetch<{ teams: TeamRow[] }>(base, "/api/finance/admin/vip-ops/tenants");
    if (r.ok) setTeams(r.data.teams);
  }, [base]);

  const loadDetail = useCallback(
    async (tenantId: string) => {
      if (!base) return;
      setDetailMsg(null);
      const r = await financeApiFetch<TenantDetail>(
        base,
        `/api/finance/admin/vip-ops/tenants/${tenantId}`,
      );
      if (r.ok) {
        setDetail(r.data);
        setCfgSeats(String(r.data.tenant.seatLimit));
        setCfgCap(r.data.tenant.perSeatCapCredits != null ? String(r.data.tenant.perSeatCapCredits) : "");
        setSelectedTenantId(tenantId);
      } else {
        setDetailMsg(r.error);
      }
    },
    [base],
  );

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  const activeScheme = useMemo(() => {
    if (!quote) return null;
    return chosen === "video_heavy" ? quote.schemeVideoHeavy : quote.schemeGeneralHeavy;
  }, [quote, chosen]);

  const seatValidation = useMemo(() => {
    if (!activeScheme || seatRows.length === 0) return null;
    const sum = sumSeatRows(seatRows);
    const ok =
      sum.general === activeScheme.generalCredits && sum.video === activeScheme.videoCredits;
    return { ...sum, ok, targetGeneral: activeScheme.generalCredits, targetVideo: activeScheme.videoCredits };
  }, [activeScheme, seatRows]);

  const runQuote = useCallback(async () => {
    if (!base) return;
    setQuoteBusy(true);
    const r = await financeApiPost<{ quote: Quote }>(base, "/api/finance/admin/vip-packages/quote", {
      amountYuan: amountTier,
      targetMargin: Number(marginPct) / 100,
    });
    setQuoteBusy(false);
    if (r.ok) setQuote(r.data.quote);
    else setOpsMsg(r.error);
  }, [base, amountTier, marginPct]);

  useEffect(() => {
    void runQuote();
  }, [runQuote]);

  useEffect(() => {
    if (!activeScheme) return;
    const seats = Math.max(1, Number(seatCount) || 1);
    if (allocationMode === "auto") {
      setSeatRows(autoSeatRows(activeScheme, seats, ownerPhone));
    } else if (seatRows.length !== seats) {
      setSeatRows((prev) => {
        const next = [...prev];
        while (next.length < seats) {
          next.push({
            label: `席位 ${next.length + 1}`,
            phone: "",
            role: "MEMBER",
            generalCredits: 0,
            videoCredits: 0,
          });
        }
        return next.slice(0, seats).map((r, i) => ({
          ...r,
          label: i === 0 ? "首席席" : `席位 ${i + 1}`,
          role: i === 0 ? "OWNER" : "MEMBER",
          phone: i === 0 ? ownerPhone : r.phone,
        }));
      });
    }
  }, [activeScheme, seatCount, allocationMode, ownerPhone]);

  async function runLookup() {
    if (!base || !lookupQ.trim()) return;
    setLookupMsg(null);
    const r = await financeApiPost<{ users: UserRow[] }>(
      base,
      "/api/finance/admin/vip-ops/users/lookup",
      { query: lookupQ.trim() },
    );
    if (r.ok) {
      setUsers(r.data.users);
      if (r.data.users.length === 0) setLookupMsg("未找到用户");
    } else {
      setLookupMsg(r.error);
    }
  }

  async function resolveOwnerPhone() {
    if (!base || !ownerPhone.trim()) return;
    const r = await financeApiPost<{ users: UserRow[] }>(
      base,
      "/api/finance/admin/vip-ops/users/lookup",
      { query: ownerPhone.trim() },
    );
    if (r.ok && r.data.users[0]) {
      setOwnerUserId(r.data.users[0].id);
      if (!teamName && r.data.users[0].vipTeamName) setTeamName(r.data.users[0].vipTeamName);
    } else {
      setOwnerUserId("");
      setOpsMsg("未找到该手机号用户，请确认已注册主站账号");
    }
  }

  async function runProvision() {
    if (!base || !quote || !activeScheme) return;
    if (!ownerPhone.trim()) {
      setOpsMsg("请填写客户主账号手机号");
      return;
    }
    if (allocationMode === "manual" && seatValidation && !seatValidation.ok) {
      setOpsMsg("手动席位分配合计与池总数不一致，请调整后再开通");
      return;
    }
    setBusy(true);
    setOpsMsg(null);
    const videoFraction =
      chosen === "video_heavy"
        ? quote.schemeVideoHeavy.videoFraction
        : quote.schemeGeneralHeavy.videoFraction;
    const r = await financeApiPost<{
      ok: boolean;
      tenantId: string;
      invitesSent?: { phone: string; inviteUrl: string | null }[];
    }>(base, "/api/finance/admin/vip-packages/provision", {
      ownerPhone: ownerPhone.trim(),
      ownerUserId: ownerUserId.trim() || undefined,
      teamName: teamName.trim() || "VIP 团队",
      amountYuan: amountTier,
      targetMargin: Number(marginPct) / 100,
      scheme: chosen,
      videoFraction,
      seats: Math.max(1, Number(seatCount) || 1),
      allocationMode,
      seatPlans: seatRows.map((row) => ({
        phone: row.phone.trim() || null,
        role: row.role,
        generalCredits: row.generalCredits,
        videoCredits: row.videoCredits,
        label: row.label,
      })),
      sendInvites: true,
    });
    setBusy(false);
    if (r.ok) {
      const sent = r.data.invitesSent?.filter((x) => x.inviteUrl).length ?? 0;
      setOpsMsg(`已开通/续充 VIP，tenantId=${r.data.tenantId}${sent > 0 ? `，已发送 ${sent} 条邀请` : ""}`);
      setSelectedTenantId(r.data.tenantId);
      await loadTeams();
      await loadDetail(r.data.tenantId);
    } else {
      setOpsMsg(r.error);
    }
  }

  async function saveConfig() {
    if (!base || !selectedTenantId) return;
    setBusy(true);
    setOpsMsg(null);
    const r = await financeApiPost<{ ok: boolean; detail: TenantDetail }>(
      base,
      `/api/finance/admin/vip-ops/tenants/${selectedTenantId}/config`,
      {
        seatLimit: Number(cfgSeats) || undefined,
        perSeatCapCredits: cfgCap.trim() === "" ? null : Number(cfgCap),
      },
    );
    setBusy(false);
    if (r.ok) {
      setDetail(r.data.detail);
      setOpsMsg("席位/人均上限已更新");
      await loadTeams();
    } else {
      setOpsMsg(r.error);
    }
  }

  async function grantCreditsAction() {
    if (!base || !selectedTenantId) return;
    setBusy(true);
    setOpsMsg(null);
    const r = await financeApiPost<{ ok: boolean; detail: TenantDetail }>(
      base,
      `/api/finance/admin/vip-ops/tenants/${selectedTenantId}/credits`,
      {
        action: "grant",
        generalCredits: Number(grantGeneral) || 0,
        videoCredits: Number(grantVideo) || 0,
        description: "VIP 后台积分发放",
      },
    );
    setBusy(false);
    if (r.ok) {
      setDetail(r.data.detail);
      setOpsMsg("积分已发放");
      await loadTeams();
    } else {
      setOpsMsg(r.error);
    }
  }

  async function adjustCreditsAction() {
    if (!base || !selectedTenantId) return;
    setBusy(true);
    setOpsMsg(null);
    const r = await financeApiPost<{ ok: boolean; detail: TenantDetail }>(
      base,
      `/api/finance/admin/vip-ops/tenants/${selectedTenantId}/credits`,
      {
        action: "adjust",
        credits: Number(adjustCredits),
        pool: adjustPool,
        description: "VIP 后台积分校正",
      },
    );
    setBusy(false);
    if (r.ok) {
      setDetail(r.data.detail);
      setOpsMsg("积分已校正");
      await loadTeams();
    } else {
      setOpsMsg(r.error);
    }
  }

  async function setMemberCap(memberId: string, cap: string) {
    if (!base || !selectedTenantId) return;
    const r = await financeApiPost<{ ok: boolean; detail: TenantDetail }>(
      base,
      `/api/finance/admin/vip-ops/tenants/${selectedTenantId}/credits`,
      {
        action: "member_cap",
        memberId,
        monthlyCapCredits: cap.trim() === "" ? null : Number(cap),
      },
    );
    if (r.ok) {
      setDetail(r.data.detail);
      setOpsMsg("成员积分上限已更新");
    } else {
      setOpsMsg(r.error);
    }
  }

  async function uploadDocument() {
    if (!base || !docFile) {
      setOpsMsg("请选择文件");
      return;
    }
    if (!selectedTenantId && !ownerUserId.trim()) {
      setOpsMsg("请先选择 VIP 团队或填写 ownerUserId");
      return;
    }
    setBusy(true);
    setOpsMsg(null);
    const fd = new FormData();
    fd.append("file", docFile);
    fd.append("kind", docKind);
    if (selectedTenantId) fd.append("tenantId", selectedTenantId);
    if (ownerUserId.trim()) fd.append("ownerUserId", ownerUserId.trim());
    if (docNote.trim()) fd.append("note", docNote.trim());

    const { url, init } = resolveBookMallBrowserRequest(
      base,
      "/api/finance/admin/vip-ops/documents/upload",
      { method: "POST", body: fd },
    );
    try {
      const res = await fetch(url, init);
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `${res.status}`);
      setOpsMsg("附件已上传");
      setDocFile(null);
      if (selectedTenantId) await loadDetail(selectedTenantId);
    } catch (e) {
      setOpsMsg(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }

  function pickUser(u: UserRow) {
    setOwnerUserId(u.id);
    if (u.phone) setOwnerPhone(u.phone);
    if (u.vipTenantId) {
      void loadDetail(u.vipTenantId);
    }
    if (!teamName && u.vipTeamName) setTeamName(u.vipTeamName);
  }

  async function sendInvite(input: {
    phone: string;
    plannedGeneralCredits?: number;
    plannedVideoCredits?: number;
  }) {
    if (!base || !selectedTenantId) return;
    const r = await financeApiPost<{ ok: boolean; inviteUrl: string | null; detail: TenantDetail }>(
      base,
      `/api/finance/admin/vip-ops/tenants/${selectedTenantId}/invites`,
      {
        action: "create",
        phone: input.phone,
        plannedGeneralCredits: input.plannedGeneralCredits ?? null,
        plannedVideoCredits: input.plannedVideoCredits ?? null,
      },
    );
    if (r.ok) {
      setDetail(r.data.detail);
      setOpsMsg(r.data.inviteUrl ? `邀请已发送：${r.data.inviteUrl}` : "邀请已创建（短信可能未发出，可复制链接）");
    } else {
      setOpsMsg(r.error);
    }
  }

  async function copyInviteLink(inviteId: string) {
    if (!base || !selectedTenantId) return;
    const r = await financeApiPost<{ ok: boolean; inviteUrl: string }>(
      base,
      `/api/finance/admin/vip-ops/tenants/${selectedTenantId}/invites`,
      { action: "link", inviteId },
    );
    if (r.ok && r.data.inviteUrl) {
      await navigator.clipboard.writeText(r.data.inviteUrl);
      setOpsMsg("邀请链接已复制");
    } else if (!r.ok) {
      setOpsMsg(r.error);
    } else {
      setOpsMsg("获取链接失败");
    }
  }

  function updateSeatRow(index: number, patch: Partial<SeatRow>) {
    setSeatRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <FinancePageShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-[#262626]">VIP 大额预充 · 运营台</h1>
          <p className="text-xs text-[#8c8c8c]">
            客户查找、充值测算、开通账号、上传合同/凭证/发票、席位与积分运维（代客户操作，不对客展示）。
          </p>
        </div>
        <Link
          href="/admin/teams"
          className="text-xs text-[#1890ff] underline"
        >
          团队列表（全量）
        </Link>
      </div>

      {opsMsg ? (
        <div className="rounded border border-[#91d5ff] bg-[#e6f7ff] px-3 py-2 text-sm text-[#0050b3]">
          {opsMsg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
        {/* 左栏：团队 + 查找 */}
        <div className="space-y-4">
          <Panel title="客户查找">
            <input
              className={inputCls}
              placeholder="手机号 / 邮箱 / 用户 ID"
              value={lookupQ}
              onChange={(e) => setLookupQ(e.target.value)}
            />
            <button
              type="button"
              className="mt-2 w-full rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white"
              onClick={() => void runLookup()}
            >
              查找
            </button>
            {lookupMsg ? <p className="mt-1 text-xs text-[#fa8c16]">{lookupMsg}</p> : null}
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
              {users.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className="w-full rounded border border-[#e8e8e8] px-2 py-1 text-left hover:bg-[#f0f6ff]"
                    onClick={() => pickUser(u)}
                  >
                    <div className="font-medium">{u.name || u.phone || u.id}</div>
                    <div className="text-[#8c8c8c]">{u.phone || u.email || u.id}</div>
                    {u.vipTenantId ? (
                      <div className="text-[#52c41a]">已有 VIP：{u.vipTeamName}</div>
                    ) : (
                      <div className="text-[#8c8c8c]">暂无 VIP 团队</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={`VIP 团队（${teams.length}）`}>
            <button
              type="button"
              className="mb-2 text-xs text-[#1890ff]"
              onClick={() => void loadTeams()}
            >
              刷新
            </button>
            <ul className="max-h-[420px] space-y-1 overflow-y-auto text-xs">
              {teams.map((t) => (
                <li key={t.tenantId}>
                  <button
                    type="button"
                    className={`w-full rounded border px-2 py-1.5 text-left ${
                      selectedTenantId === t.tenantId
                        ? "border-[#1890ff] bg-[#f0f6ff]"
                        : "border-[#e8e8e8] hover:bg-[#fafafa]"
                    }`}
                    onClick={() => void loadDetail(t.tenantId)}
                  >
                    <div className="font-medium">{t.name}</div>
                    <div className="text-[#8c8c8c]">
                      {t.seatLimit} 席 · 通用 {credits(t.generalCredits)} / 视频 {credits(t.videoCredits)}
                    </div>
                    <div className="text-[#8c8c8c]">{t.owner.phone || t.owner.name || t.owner.id}</div>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* 右栏：运营 */}
        <div className="space-y-4">
          <Panel title="① 充值测算与开通">
            <p className="mb-2 text-xs text-[#8c8c8c]">
              选择充值档位并输入目标毛利，系统自动生成「通用多 / 视频多」两套方案；席位支持自动均分或手动分配（实时校验合计）。
            </p>
            <div className="flex flex-wrap gap-2">
              {AMOUNT_TIERS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  className={`rounded border px-3 py-1 text-xs ${
                    amountTier === tier
                      ? "border-[#1890ff] bg-[#f0f6ff] text-[#1890ff]"
                      : "border-[#d9d9d9] hover:border-[#1890ff]"
                  }`}
                  onClick={() => setAmountTier(tier)}
                >
                  ¥{tier.toLocaleString("zh-CN")}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="text-xs">
                目标毛利 %
                <input className={inputCls} type="number" min={0} max={99} value={marginPct} onChange={(e) => setMarginPct(e.target.value)} />
              </label>
              <label className="text-xs">
                客户主账号手机号
                <input
                  className={inputCls}
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  onBlur={() => void resolveOwnerPhone()}
                  placeholder="11 位手机号"
                />
              </label>
              <label className="text-xs">
                席位数
                <input className={inputCls} type="number" min={1} value={seatCount} onChange={(e) => setSeatCount(e.target.value)} />
              </label>
              <label className="col-span-2 text-xs sm:col-span-4">
                团队名称
                <input className={inputCls} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="VIP 团队" />
              </label>
            </div>

            {quoteBusy ? <p className="mt-2 text-xs text-[#8c8c8c]">测算中…</p> : null}
            {quote && activeScheme ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {(
                  [
                    ["general_heavy", "方案 A · 通用多", quote.schemeGeneralHeavy, "视频算力约 15%，偏图文/文本"],
                    ["video_heavy", "方案 B · 视频多", quote.schemeVideoHeavy, "视频算力约 40%，偏短视频/数字人"],
                  ] as const
                ).map(([key, title, scheme, scene]) => (
                  <label
                    key={key}
                    className={`block cursor-pointer rounded border p-3 text-xs ${
                      chosen === key ? "border-[#1890ff] bg-[#f0f6ff]" : "border-[#e8e8e8]"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium text-[#262626]">
                      <input type="radio" checked={chosen === key} onChange={() => setChosen(key)} />
                      {title}
                    </div>
                    <p className="mt-1 text-[#8c8c8c]">{scene}</p>
                    <p className="mt-2">总积分 {credits(scheme.totalCredits)}</p>
                    <p>通用 {credits(scheme.generalCredits)} · 视频 {credits(scheme.videoCredits)}</p>
                    <p className="mt-1 text-[#8c8c8c]">{formatPowerRef(scheme.faceValueYuan)}</p>
                    <p className="text-[#8c8c8c]">实际毛利 {(scheme.actualMargin * 100).toFixed(1)}%</p>
                  </label>
                ))}
              </div>
            ) : null}

            <div className="mt-4 border-t border-[#f0f0f0] pt-3">
              <p className="text-xs font-medium text-[#595959]">席位积分分配</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <label>
                  <input type="radio" className="mr-1" checked={allocationMode === "auto"} onChange={() => setAllocationMode("auto")} />
                  自动均分（余数归首席席）
                </label>
                <label>
                  <input type="radio" className="mr-1" checked={allocationMode === "manual"} onChange={() => setAllocationMode("manual")} />
                  手动分配（实时校验合计）
                </label>
              </div>
              {seatRows.length > 0 && activeScheme ? (
                <>
                  <table className="mt-2 w-full text-xs">
                    <thead>
                      <tr className="text-left text-[#8c8c8c]">
                        <th className="py-1">席位</th>
                        <th>手机号</th>
                        <th>通用积分</th>
                        <th>视频积分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seatRows.map((row, i) => (
                        <tr key={`${row.label}-${i}`} className="border-t border-[#f0f0f0]">
                          <td className="py-1 pr-2">{row.label}</td>
                          <td className="pr-2">
                            <input
                              className="w-full min-w-[108px] rounded border border-[#d9d9d9] px-1 py-0.5"
                              value={row.phone}
                              disabled={row.role === "OWNER"}
                              placeholder={row.role === "OWNER" ? "主账号" : "成员手机号"}
                              onChange={(e) => updateSeatRow(i, { phone: e.target.value })}
                            />
                          </td>
                          <td className="pr-2">
                            <input
                              className="w-24 rounded border border-[#d9d9d9] px-1 py-0.5"
                              type="number"
                              min={0}
                              value={row.generalCredits}
                              disabled={allocationMode === "auto"}
                              onChange={(e) => updateSeatRow(i, { generalCredits: Number(e.target.value) || 0 })}
                            />
                          </td>
                          <td>
                            <input
                              className="w-24 rounded border border-[#d9d9d9] px-1 py-0.5"
                              type="number"
                              min={0}
                              value={row.videoCredits}
                              disabled={allocationMode === "auto"}
                              onChange={(e) => updateSeatRow(i, { videoCredits: Number(e.target.value) || 0 })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {seatValidation ? (
                    <p className={`mt-2 text-xs ${seatValidation.ok ? "text-[#52c41a]" : "text-[#fa8c16]"}`}>
                      合计：通用 {credits(seatValidation.general)} / {credits(seatValidation.targetGeneral)}
                      ，视频 {credits(seatValidation.video)} / {credits(seatValidation.targetVideo)}
                      {seatValidation.ok ? " · 已对齐" : " · 请调整至与池总数一致"}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !quote || (allocationMode === "manual" && seatValidation != null && !seatValidation.ok)}
                className="rounded bg-[#52c41a] px-3 py-1 text-sm text-white disabled:opacity-50"
                onClick={() => void runProvision()}
              >
                开通 / 续充并发放积分（自动发邀请）
              </button>
            </div>
          </Panel>

          <Panel title="② 合同 / 支付凭证 / 发票">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="text-xs">
                类型
                <select className={inputCls} value={docKind} onChange={(e) => setDocKind(e.target.value)}>
                  {Object.entries(DOC_KIND_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 text-xs sm:col-span-3">
                备注
                <input className={inputCls} value={docNote} onChange={(e) => setDocNote(e.target.value)} placeholder="可选" />
              </label>
              <label className="col-span-2 text-xs sm:col-span-4">
                文件（PDF / 图片 / Word，≤25MB）
                <input
                  className="mt-1 block w-full text-xs"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <button type="button" disabled={busy} className="mt-2 rounded bg-[#1890ff] px-3 py-1 text-sm text-white" onClick={() => void uploadDocument()}>
              上传附件
            </button>
            {detail?.documents.length ? (
              <ul className="mt-3 space-y-1 text-xs">
                {detail.documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[#f5f5f5] px-1">{DOC_KIND_LABEL[d.kind] ?? d.kind}</span>
                    <a href={d.ossUrl} target="_blank" rel="noreferrer" className="text-[#1890ff] underline">
                      {d.filename}
                    </a>
                    {d.note ? <span className="text-[#8c8c8c]">{d.note}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[#8c8c8c]">暂无附件（选择团队后上传将关联 tenantId）</p>
            )}
          </Panel>

          {detail ? (
            <>
              <Panel title={`③ 席位与积分运维 · ${detail.tenant.name}`}>
                <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <Stat label="通用积分" value={credits(detail.credits.general)} />
                  <Stat label="视频积分" value={credits(detail.credits.video)} />
                  <Stat label="席位" value={`${detail.members.length} / ${detail.tenant.seatLimit}`} />
                  <Stat label="人均上限" value={detail.credits.perSeatCapCredits != null ? credits(detail.credits.perSeatCapCredits) : "未设"} />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="text-xs">
                    席位上限
                    <input className={inputCls} type="number" value={cfgSeats} onChange={(e) => setCfgSeats(e.target.value)} />
                  </label>
                  <label className="text-xs">
                    人均积分上限
                    <input className={inputCls} type="number" value={cfgCap} onChange={(e) => setCfgCap(e.target.value)} placeholder="留空=不限" />
                  </label>
                </div>
                <button type="button" disabled={busy} className="mt-2 rounded border border-[#1890ff] px-3 py-1 text-sm text-[#1890ff]" onClick={() => void saveConfig()}>
                  保存席位 / 人均配置
                </button>

                <div className="mt-4 border-t border-[#f0f0f0] pt-3">
                  <p className="text-xs font-medium text-[#595959]">积分发放（充值到账 / 测试）</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="text-xs">
                      通用积分
                      <input className={inputCls} type="number" value={grantGeneral} onChange={(e) => setGrantGeneral(e.target.value)} />
                    </label>
                    <label className="text-xs">
                      视频积分
                      <input className={inputCls} type="number" value={grantVideo} onChange={(e) => setGrantVideo(e.target.value)} />
                    </label>
                  </div>
                  <button type="button" disabled={busy} className="mt-2 rounded bg-[#52c41a] px-3 py-1 text-sm text-white" onClick={() => void grantCreditsAction()}>
                    发放积分
                  </button>
                </div>

                <div className="mt-4 border-t border-[#f0f0f0] pt-3">
                  <p className="text-xs font-medium text-[#595959]">积分校正（±，测试/回补）</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="text-xs">
                      数额（可负）
                      <input className={inputCls} type="number" value={adjustCredits} onChange={(e) => setAdjustCredits(e.target.value)} />
                    </label>
                    <label className="text-xs">
                      池
                      <select className={inputCls} value={adjustPool} onChange={(e) => setAdjustPool(e.target.value as "GENERAL" | "VIDEO")}>
                        <option value="GENERAL">通用</option>
                        <option value="VIDEO">视频</option>
                      </select>
                    </label>
                  </div>
                  <button type="button" disabled={busy} className="mt-2 rounded border border-[#fa8c16] px-3 py-1 text-sm text-[#fa8c16]" onClick={() => void adjustCreditsAction()}>
                    校正积分
                  </button>
                </div>
              </Panel>

              <Panel title="④ 成员积分上限（代客户分配）">
                <ul className="space-y-2 text-xs">
                  {detail.members.map((m) => (
                    <MemberCapRow
                      key={m.id}
                      member={m}
                      onSave={(cap) => void setMemberCap(m.id, cap)}
                    />
                  ))}
                </ul>
              </Panel>

              <Panel title="⑤ 席位邀请（短信 / 链接）">
                <p className="text-xs text-[#8c8c8c]">
                  为成员席位发送邀请码；受邀人加入后按预分配积分额度使用（通用池 personal cap）。
                </p>
                {detail.invites?.length ? (
                  <ul className="mt-2 space-y-2 text-xs">
                    {detail.invites.map((inv) => (
                      <li key={inv.id} className="flex flex-wrap items-center gap-2 rounded border border-[#f0f0f0] px-2 py-1.5">
                        <span className="font-medium">{inv.phone}</span>
                        <span className="text-[#8c8c8c]">
                          通用 {inv.plannedGeneralCredits != null ? credits(inv.plannedGeneralCredits) : "—"}
                          {" / "}
                          视频 {inv.plannedVideoCredits != null ? credits(inv.plannedVideoCredits) : "—"}
                        </span>
                        <button type="button" className="text-[#1890ff]" onClick={() => void copyInviteLink(inv.id)}>
                          复制邀请链接
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-[#8c8c8c]">暂无待接受邀请</p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <InviteSendRow onSend={(p) => void sendInvite(p)} />
                </div>
              </Panel>

              <Panel title="积分批次（到期）">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[#8c8c8c]">
                      <th className="py-1">池</th>
                      <th>来源</th>
                      <th>余额</th>
                      <th>到期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.creditLots.map((l) => (
                      <tr key={`${l.pool}-${l.source}-${l.remainingCredits}-${l.expiresAt}`} className="border-t border-[#f0f0f0]">
                        <td className="py-1">{l.pool}</td>
                        <td>{l.source}</td>
                        <td>{credits(l.remainingCredits)}</td>
                        <td>{l.expiresAt ? l.expiresAt.slice(0, 10) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            </>
          ) : (
            <Panel title="③ 席位与积分运维">
              <p className="text-xs text-[#8c8c8c]">请从左侧选择 VIP 团队，或通过客户查找后开通。</p>
              {detailMsg ? <p className="mt-1 text-xs text-red-600">{detailMsg}</p> : null}
            </Panel>
          )}
        </div>
      </div>
    </FinancePageShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-[#e8e8e8] bg-white p-4">
      <h2 className="text-sm font-medium text-[#262626]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#f0f0f0] bg-[#fafafa] px-2 py-1.5">
      <div className="text-[10px] text-[#8c8c8c]">{label}</div>
      <div className="text-sm font-medium text-[#262626]">{value}</div>
    </div>
  );
}

function InviteSendRow({ onSend }: { onSend: (p: { phone: string; plannedGeneralCredits?: number; plannedVideoCredits?: number }) => void }) {
  const [phone, setPhone] = useState("");
  const [general, setGeneral] = useState("");
  const [video, setVideo] = useState("");
  return (
    <>
      <label className="text-xs sm:col-span-2">
        成员手机号
        <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="发送新邀请" />
      </label>
      <label className="text-xs">
        通用额度
        <input className={inputCls} type="number" value={general} onChange={(e) => setGeneral(e.target.value)} />
      </label>
      <label className="text-xs">
        视频额度
        <input className={inputCls} type="number" value={video} onChange={(e) => setVideo(e.target.value)} />
      </label>
      <button
        type="button"
        className="rounded bg-[#1890ff] px-3 py-1 text-sm text-white sm:col-span-4 sm:w-fit"
        onClick={() =>
          onSend({
            phone: phone.trim(),
            plannedGeneralCredits: general.trim() === "" ? undefined : Number(general),
            plannedVideoCredits: video.trim() === "" ? undefined : Number(video),
          })
        }
      >
        发送邀请
      </button>
    </>
  );
}

function MemberCapRow({
  member,
  onSave,
}: {
  member: TenantDetail["members"][number];
  onSave: (cap: string) => void;
}) {
  const [cap, setCap] = useState(member.monthlyCapCredits != null ? String(member.monthlyCapCredits) : "");
  return (
    <li className="flex flex-wrap items-center gap-2 rounded border border-[#f0f0f0] px-2 py-1.5">
      <span className="min-w-[120px] font-medium">
        {member.user.name || member.user.phone || member.userId}
        <span className="ml-1 text-[#8c8c8c]">({member.role})</span>
      </span>
      <input
        className="w-28 rounded border border-[#d9d9d9] px-1 py-0.5"
        type="number"
        placeholder="月上限"
        value={cap}
        onChange={(e) => setCap(e.target.value)}
      />
      <button type="button" className="text-[#1890ff]" onClick={() => onSave(cap)}>
        保存
      </button>
    </li>
  );
}
