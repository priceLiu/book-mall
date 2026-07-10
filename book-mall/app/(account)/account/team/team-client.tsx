"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  acceptInviteAction,
  createTeamAction,
  getInviteLinkAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInviteAction,
  switchSpaceAction,
  transferOwnershipAction,
  updateConfigAction,
  updateMemberCapAction,
  updateRoleAction,
} from "./team-actions";
import { TEAM_MIN_INCLUDED_SEATS } from "@/lib/billing/team-membership-config";
import { maskPhone } from "@/lib/auth/phone";
import type { ActionResult } from "@/lib/server-action-result";

type Role = "OWNER" | "ADMIN" | "MEMBER";

interface MembershipSummary {
  tenantId: string;
  tenantName: string;
  tenantType: "PERSONAL" | "TEAM";
  role: Role;
  seatId: string | null;
  isPrimary: boolean;
}

interface Overview {
  tenant: {
    id: string;
    name: string;
    packageLevel: string | null;
    interval: "MONTH" | "YEAR" | null;
    seatLimit: number;
    maxConcurrency: number;
    perSeatCapCredits: number | null;
    currentPeriodEnd: string | null;
  };
  usedSeats: number;
  balanceCredits: number;
  videoBalanceCredits: number;
  monthlyGrantCredits: number;
  members: {
    id: string;
    userId: string;
    name: string | null;
    phone: string | null;
    image: string | null;
    role: Role;
    status: string;
    seatLabel: string | null;
    monthlyCapCredits: number | null;
  }[];
}

interface Props {
  userId: string;
  userPhone: string | null;
  memberships: MembershipSummary[];
  activeTenantId: string | null;
  selectedTeamId: string | null;
  myRole: Role | null;
  overview: Overview | null;
  invites: {
    id: string;
    token: string;
    phone: string;
    role: Role;
    expiresAt: string;
    urlCode: string | null;
    plannedGeneralCredits: number | null;
    plannedVideoCredits: number | null;
  }[];
  incomingInvites: { token: string; tenantName: string; role: Role; urlCode: string | null }[];
  teamPlans: {
    id: string;
    tier: string;
    interval: "MONTH" | "YEAR";
    priceYuan: number;
    monthlyCredits: number;
    includedSeats: number;
  }[];
}

function memberLabel(m: { name: string | null; phone: string | null }): string {
  if (m.name?.trim()) return m.name.trim();
  if (m.phone) return maskPhone(m.phone);
  return "（未命名）";
}

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "所有者",
  ADMIN: "管理员",
  MEMBER: "成员",
};

function MemberCapEditor({
  memberId,
  tenantId,
  value,
  pending,
  buildFD,
  run,
}: {
  memberId: string;
  tenantId: string;
  value: number | null;
  pending: boolean;
  buildFD: (e: Record<string, string>) => FormData;
  run: <T>(a: () => Promise<ActionResult<T>>, ok?: string) => void;
}) {
  const [cap, setCap] = useState(value != null ? String(value) : "");
  return (
    <div className="flex items-center gap-1">
      <Input
        className="h-8 w-24"
        type="number"
        min={0}
        value={cap}
        placeholder="不限"
        onChange={(e) => setCap(e.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          run(
            () =>
              updateMemberCapAction(
                buildFD({
                  tenantId,
                  memberId,
                  monthlyCapCredits: cap,
                }),
              ),
            "额度已保存",
          )
        }
      >
        保存
      </Button>
    </div>
  );
}

function CopyInviteLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function copy() {
    setCopyErr(null);
    startTransition(async () => {
      const res = await getInviteLinkAction(token);
      if (!res.ok) {
        setCopyErr(res.error);
        return;
      }
      const url = res.data.inviteUrl;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopyErr("无法写入剪贴板，请检查浏览器权限");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void copy()}>
        {copied ? "已复制" : pending ? "生成中…" : "复制链接"}
      </Button>
      {copyErr ? <span className="text-xs text-red-600">{copyErr}</span> : null}
    </div>
  );
}

function Notice({ msg }: { msg: { type: "ok" | "err"; text: string } | null }) {
  if (!msg) return null;
  return (
    <div
      className={`mt-2 rounded-md px-3 py-2 text-sm ${
        msg.type === "ok"
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      }`}
    >
      {msg.text}
    </div>
  );
}

/** 两步确认弹层（避免原生 window.confirm；破坏性操作二次确认）。 */
function ConfirmModal({
  open,
  title,
  firstMessage,
  secondMessage,
  confirmLabel,
  onCancel,
  onConfirm,
  busy,
}: {
  open: boolean;
  title: string;
  firstMessage: string;
  secondMessage: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const [step, setStep] = useState(1);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-background p-5 shadow-xl">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {step === 1 ? firstMessage : secondMessage}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStep(1);
              onCancel();
            }}
            disabled={busy}
          >
            取消
          </Button>
          {step === 1 ? (
            <Button variant="destructive" size="sm" onClick={() => setStep(2)}>
              继续
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? "处理中…" : confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TeamClient(props: Props) {
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<{
    title: string;
    first: string;
    second: string;
    label: string;
    run: () => Promise<ActionResult<any>>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  function run<T = undefined>(
    action: () => Promise<ActionResult<T>>,
    okText = "操作成功",
  ) {
    startTransition(async () => {
      setMsg(null);
      const res = await action();
      setMsg(res.ok ? { type: "ok", text: okText } : { type: "err", text: res.error });
    });
  }

  function buildFD(entries: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(entries)) fd.set(k, v);
    return fd;
  }

  const canManage = props.myRole === "OWNER" || props.myRole === "ADMIN";
  const canConfigure = props.myRole === "OWNER";

  return (
    <div className="space-y-4">
      {/* 空间切换器 */}
      {props.memberships.length > 1 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">当前空间</CardTitle>
            <CardDescription>切换个人空间与团队空间（影响计费归属与资产可见范围）</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {props.memberships.map((m) => {
              const active = m.tenantId === props.activeTenantId;
              return (
                <Button
                  key={m.tenantId}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  disabled={pending || active}
                  onClick={() =>
                    run(
                      () => switchSpaceAction(buildFD({ tenantId: m.tenantId })),
                      `已切换到「${m.tenantName}」`,
                    )
                  }
                >
                  {m.tenantType === "TEAM" ? "团队·" : "个人·"}
                  {m.tenantName}
                  {m.tenantType === "TEAM" ? `（${ROLE_LABEL[m.role]}）` : ""}
                </Button>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {/* 收到的邀请 */}
      {props.incomingInvites.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">待接受的团队邀请</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {props.incomingInvites.map((i) => (
              <div
                key={i.token}
                className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm">
                  「{i.tenantName}」邀请你以 <b>{ROLE_LABEL[i.role]}</b> 身份加入
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={
                        i.urlCode
                          ? `/invite/t/${i.token}?${new URLSearchParams({ code: i.urlCode })}`
                          : `/invite/t/${i.token}`
                      }
                    >
                      打开邀请页
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => acceptInviteAction(buildFD({ token: i.token })),
                        "已加入团队",
                      )
                    }
                  >
                    直接接受
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Notice msg={msg} />

      {props.overview ? (
        <TeamOverview
          {...props}
          overview={props.overview}
          canManage={canManage}
          canConfigure={canConfigure}
          pending={pending}
          run={run}
          buildFD={buildFD}
          requestConfirm={(c) => setConfirm(c)}
        />
      ) : (
        <CreateTeam teamPlans={props.teamPlans} pending={pending} run={run} buildFD={buildFD} />
      )}

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title ?? ""}
        firstMessage={confirm?.first ?? ""}
        secondMessage={confirm?.second ?? ""}
        confirmLabel={confirm?.label ?? "确认"}
        busy={confirmBusy}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          setConfirmBusy(true);
          const res = await confirm.run();
          setConfirmBusy(false);
          setConfirm(null);
          setMsg(res.ok ? { type: "ok", text: "操作成功" } : { type: "err", text: res.error });
        }}
      />
    </div>
  );
}

function CreateTeam({
  teamPlans,
  pending,
  run,
  buildFD,
}: {
  teamPlans: Props["teamPlans"];
  pending: boolean;
  run: <T>(a: () => Promise<ActionResult<T>>, ok?: string) => void;
  buildFD: (e: Record<string, string>) => FormData;
}) {
  const [name, setName] = useState("");
  const [planId, setPlanId] = useState(teamPlans[0]?.id ?? "");
  const selectedPlan = teamPlans.find((p) => p.id === planId) ?? teamPlans[0];
  const minSeats = Math.max(TEAM_MIN_INCLUDED_SEATS, selectedPlan?.includedSeats ?? TEAM_MIN_INCLUDED_SEATS);
  const [seats, setSeats] = useState(minSeats);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">开通团队 / 公司版</CardTitle>
        <CardDescription>
          选择团队套餐与席位数。开通后将创建团队空间、分配席位并发放共享积分池。
          {teamPlans.length === 0 ? "（暂无可用团队套餐，请联系管理员在后台配置）" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="team-name">团队名称</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：星辰工作室"
            />
          </div>
          <div>
            <Label htmlFor="team-seats">席位数</Label>
            <Input
              id="team-seats"
              type="number"
              min={minSeats}
              value={seats}
              onChange={(e) => setSeats(Math.max(minSeats, Number(e.target.value) || minSeats))}
            />
            <p className="mt-1 text-xs text-muted-foreground">{minSeats} 席起订</p>
          </div>
        </div>
        {teamPlans.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {teamPlans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPlanId(p.id);
                  setSeats((s) => Math.max(TEAM_MIN_INCLUDED_SEATS, p.includedSeats, s));
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  planId === p.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-accent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.tier}</span>
                  <Badge variant="secondary">
                    {p.interval === "YEAR" ? "年付" : "月付"}
                  </Badge>
                </div>
                <div className="mt-1 text-2xl font-bold">¥{p.priceYuan}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  起订 {Math.max(TEAM_MIN_INCLUDED_SEATS, p.includedSeats)} 席 · 每席 {p.monthlyCredits.toLocaleString()} 积分/月
                </div>
              </button>
            ))}
          </div>
        ) : null}
        <Button
          disabled={pending || !planId || !name.trim()}
          onClick={() =>
            run(
              () =>
                createTeamAction(
                  buildFD({ name, planId, totalSeats: String(seats) }),
                ),
              "团队已开通",
            )
          }
        >
          {pending ? "开通中…" : "开通团队"}
        </Button>
      </CardContent>
    </Card>
  );
}

function TeamOverview({
  overview,
  invites,
  myRole,
  canManage,
  canConfigure,
  pending,
  run,
  buildFD,
  requestConfirm,
}: Props & {
  overview: Overview;
  canManage: boolean;
  canConfigure: boolean;
  pending: boolean;
  run: <T>(a: () => Promise<ActionResult<T>>, ok?: string) => void;
  buildFD: (e: Record<string, string>) => FormData;
  requestConfirm: (c: {
    title: string;
    first: string;
    second: string;
    label: string;
    run: () => Promise<ActionResult<any>>;
  }) => void;
}) {
  const t = overview.tenant;
  const isVip = t.packageLevel === "VIP";
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("MEMBER");
  const [inviteGeneral, setInviteGeneral] = useState("");
  const [inviteVideo, setInviteVideo] = useState("");
  const [cfgName, setCfgName] = useState(t.name);
  const [cfgSeatLimit, setCfgSeatLimit] = useState(t.seatLimit);
  const [cfgCap, setCfgCap] = useState(
    t.perSeatCapCredits != null ? String(t.perSeatCapCredits) : "",
  );
  const [cfgConcurrency, setCfgConcurrency] = useState(t.maxConcurrency);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">团队套餐</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold">{t.packageLevel ?? "—"}</div>
              {isVip ? <Badge variant="secondary">大额预充</Badge> : null}
            </div>
            <CardDescription>
              {isVip ? "双池积分 · 5年有效" : t.interval === "YEAR" ? "年付" : "月付"}
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">{isVip ? "通用积分池" : "共享积分池"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.balanceCredits.toLocaleString()}</div>
            <CardDescription>
              {isVip
                ? "预充额度 · 无月度清零"
                : `月发放 ${overview.monthlyGrantCredits.toLocaleString()}`}
            </CardDescription>
          </CardContent>
        </Card>
        {isVip ? (
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">视频积分池</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.videoBalanceCredits.toLocaleString()}</div>
              <CardDescription>与通用池独立消耗</CardDescription>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">席位占用</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overview.usedSeats}/{t.seatLimit}
              </div>
              <CardDescription>已用 / 总席位</CardDescription>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">{isVip ? "席位占用" : "人均月上限"}</CardTitle>
          </CardHeader>
          <CardContent>
            {isVip ? (
              <>
                <div className="text-2xl font-bold">
                  {overview.usedSeats}/{t.seatLimit}
                </div>
                <CardDescription>已用 / 总席位</CardDescription>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {t.perSeatCapCredits != null ? t.perSeatCapCredits.toLocaleString() : "不限"}
                </div>
                <CardDescription>每成员积分上限</CardDescription>
              </>
            )}
          </CardContent>
        </Card>
        {!isVip ? null : (
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">默认人均上限</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {t.perSeatCapCredits != null ? t.perSeatCapCredits.toLocaleString() : "按成员分配"}
              </div>
              <CardDescription>新成员默认参考值</CardDescription>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 成员管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">成员</CardTitle>
          <CardDescription>共 {overview.members.length} 名成员</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>成员</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>席位</TableHead>
                {isVip && canConfigure ? <TableHead>通用额度</TableHead> : null}
                {canManage ? <TableHead className="text-right">操作</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="font-medium">{m.name?.trim() || "（未命名）"}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.phone ? maskPhone(m.phone) : "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {canManage && m.role !== "OWNER" ? (
                      <select
                        defaultValue={m.role}
                        disabled={pending}
                        className="h-8 rounded-md border bg-background px-2 text-sm"
                        onChange={(e) =>
                          run(
                            () =>
                              updateRoleAction(
                                buildFD({
                                  tenantId: t.id,
                                  memberId: m.id,
                                  role: e.target.value,
                                }),
                              ),
                            "角色已更新",
                          )
                        }
                      >
                        <option value="ADMIN">管理员</option>
                        <option value="MEMBER">成员</option>
                      </select>
                    ) : (
                      <Badge variant={m.role === "OWNER" ? "default" : "secondary"}>
                        {ROLE_LABEL[m.role]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.seatLabel ?? "—"}
                  </TableCell>
                  {isVip && canConfigure ? (
                    <TableCell>
                      <MemberCapEditor
                        memberId={m.id}
                        tenantId={t.id}
                        value={m.monthlyCapCredits}
                        pending={pending}
                        buildFD={buildFD}
                        run={run}
                      />
                    </TableCell>
                  ) : null}
                  {canManage ? (
                    <TableCell className="text-right">
                      {m.role !== "OWNER" ? (
                        <div className="flex justify-end gap-2">
                          {myRole === "OWNER" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={pending}
                              onClick={() =>
                                requestConfirm({
                                  title: "转移所有权",
                                  first: `确定将团队所有权转移给「${memberLabel(m)}」？`,
                                  second:
                                    "转移后你将降为管理员，无法再进行计费/充值/删除团队等操作。此操作不可撤销，确定继续？",
                                  label: "确认转移",
                                  run: () =>
                                    transferOwnershipAction(
                                      buildFD({ tenantId: t.id, memberId: m.id }),
                                    ),
                                })
                              }
                            >
                              转为所有者
                            </Button>
                          ) : null}
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              requestConfirm({
                                title: "移除成员",
                                first: `确定将「${memberLabel(m)}」移出团队？其席位将被释放。`,
                                second:
                                  "移除后该成员将立即失去团队空间访问权；其在本团队的私有资产将自动转入「团队公共库」（保留原创建者署名，不会删除云端文件）。此操作不可恢复，确定继续？",
                                label: "确认移除",
                                run: () =>
                                  removeMemberAction(
                                    buildFD({
                                      tenantId: t.id,
                                      memberId: m.id,
                                      assetDisposition: "TRANSFER_PUBLIC",
                                    }),
                                  ),
                              })
                            }
                          >
                            移除
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 邀请成员 */}
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">邀请成员</CardTitle>
            <CardDescription>
              {isVip
                ? "按手机号邀请成员并预分配积分额度；请将邀请链接发给席位使用者（与团队邀请相同）。"
                : "邀请将占用一个席位名额。请将邀请链接发给成员（新用户需在链接页注册后再加入团队）。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="invite-phone">手机号</Label>
                <Input
                  id="invite-phone"
                  type="tel"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  placeholder="13800138000"
                />
              </div>
              {isVip ? (
                <>
                  <div>
                    <Label htmlFor="invite-general">通用积分</Label>
                    <Input
                      id="invite-general"
                      type="number"
                      min={0}
                      value={inviteGeneral}
                      onChange={(e) => setInviteGeneral(e.target.value)}
                      placeholder="预分配"
                    />
                  </div>
                  <div>
                    <Label htmlFor="invite-video">视频积分</Label>
                    <Input
                      id="invite-video"
                      type="number"
                      min={0}
                      value={inviteVideo}
                      onChange={(e) => setInviteVideo(e.target.value)}
                      placeholder="预分配"
                    />
                  </div>
                </>
              ) : null}
              <div>
                <Label htmlFor="invite-role">角色</Label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="block h-9 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="MEMBER">成员</option>
                  <option value="ADMIN">管理员</option>
                </select>
              </div>
              <Button
                disabled={pending || !invitePhone.trim()}
                onClick={() =>
                  run(
                    () =>
                      inviteMemberAction(
                        buildFD({
                          tenantId: t.id,
                          phone: invitePhone,
                          role: inviteRole,
                          ...(isVip
                            ? {
                                plannedGeneralCredits: inviteGeneral,
                                plannedVideoCredits: inviteVideo,
                              }
                            : {}),
                        }),
                      ),
                    "邀请短信已发送",
                  )
                }
              >
                发送邀请
              </Button>
            </div>

            {invites.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">待接受邀请</div>
                {invites.map((i) => (
                  <div
                    key={i.id}
                    className="flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span>
                      {maskPhone(i.phone)}（{ROLE_LABEL[i.role]}） · 过期{" "}
                      {new Date(i.expiresAt).toLocaleDateString("zh-CN")}
                      {isVip &&
                      (i.plannedGeneralCredits != null || i.plannedVideoCredits != null) ? (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          预分配：通用{" "}
                          {i.plannedGeneralCredits != null
                            ? i.plannedGeneralCredits.toLocaleString()
                            : "—"}
                          {" · "}视频{" "}
                          {i.plannedVideoCredits != null
                            ? i.plannedVideoCredits.toLocaleString()
                            : "—"}
                        </span>
                      ) : null}
                    </span>
                    <div className="flex shrink-0 gap-2">
                      <CopyInviteLinkButton token={i.token} />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () =>
                              revokeInviteAction(
                                buildFD({ tenantId: t.id, inviteId: i.id }),
                              ),
                            "邀请已撤销",
                          )
                        }
                      >
                        撤销
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* 团队配置（仅 OWNER） */}
      {canConfigure ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">团队配置</CardTitle>
            <CardDescription>名称、席位上限、人均月积分上限、并发上限</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="cfg-name">团队名称</Label>
              <Input id="cfg-name" value={cfgName} onChange={(e) => setCfgName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cfg-seats">席位上限</Label>
              <Input
                id="cfg-seats"
                type="number"
                min={overview.usedSeats}
                value={cfgSeatLimit}
                onChange={(e) => setCfgSeatLimit(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div>
              <Label htmlFor="cfg-cap">人均月积分上限（留空=不限）</Label>
              <Input
                id="cfg-cap"
                type="number"
                min={0}
                value={cfgCap}
                onChange={(e) => setCfgCap(e.target.value)}
                placeholder="不限"
              />
            </div>
            <div>
              <Label htmlFor="cfg-concurrency">并发上限</Label>
              <Input
                id="cfg-concurrency"
                type="number"
                min={1}
                value={cfgConcurrency}
                onChange={(e) => setCfgConcurrency(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      updateConfigAction(
                        buildFD({
                          tenantId: t.id,
                          name: cfgName,
                          seatLimit: String(cfgSeatLimit),
                          perSeatCapCredits: cfgCap,
                          maxConcurrency: String(cfgConcurrency),
                        }),
                      ),
                    "配置已保存",
                  )
                }
              >
                保存配置
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
