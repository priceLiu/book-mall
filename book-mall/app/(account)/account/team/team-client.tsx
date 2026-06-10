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
  inviteMemberAction,
  removeMemberAction,
  revokeInviteAction,
  switchSpaceAction,
  transferOwnershipAction,
  updateConfigAction,
  updateRoleAction,
} from "./team-actions";
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
  monthlyGrantCredits: number;
  members: {
    id: string;
    userId: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: Role;
    status: string;
    seatLabel: string | null;
  }[];
}

interface Props {
  userId: string;
  userEmail: string | null;
  memberships: MembershipSummary[];
  activeTenantId: string | null;
  selectedTeamId: string | null;
  myRole: Role | null;
  overview: Overview | null;
  invites: { id: string; email: string; role: Role; expiresAt: string }[];
  incomingInvites: { token: string; tenantName: string; role: Role }[];
  teamPlans: {
    id: string;
    tier: string;
    interval: "MONTH" | "YEAR";
    priceYuan: number;
    monthlyCredits: number;
    includedSeats: number;
  }[];
}

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "所有者",
  ADMIN: "管理员",
  MEMBER: "成员",
};

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
    run: () => Promise<ActionResult>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  function run(action: () => Promise<ActionResult>, okText = "操作成功") {
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
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span className="text-sm">
                  「{i.tenantName}」邀请你以 <b>{ROLE_LABEL[i.role]}</b> 身份加入
                </span>
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
                  接受
                </Button>
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
  run: (a: () => Promise<ActionResult>, ok?: string) => void;
  buildFD: (e: Record<string, string>) => FormData;
}) {
  const [name, setName] = useState("");
  const [planId, setPlanId] = useState(teamPlans[0]?.id ?? "");
  const [seats, setSeats] = useState(teamPlans[0]?.includedSeats ?? 1);

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
              min={1}
              value={seats}
              onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))}
            />
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
                  setSeats((s) => Math.max(s, p.includedSeats));
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
                  含 {p.includedSeats} 席 · 每席 {p.monthlyCredits.toLocaleString()} 积分/月
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
  run: (a: () => Promise<ActionResult>, ok?: string) => void;
  buildFD: (e: Record<string, string>) => FormData;
  requestConfirm: (c: {
    title: string;
    first: string;
    second: string;
    label: string;
    run: () => Promise<ActionResult>;
  }) => void;
}) {
  const t = overview.tenant;
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("MEMBER");
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
            <div className="text-lg font-bold">{t.packageLevel ?? "—"}</div>
            <CardDescription>{t.interval === "YEAR" ? "年付" : "月付"}</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">共享积分池</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.balanceCredits.toLocaleString()}</div>
            <CardDescription>月发放 {overview.monthlyGrantCredits.toLocaleString()}</CardDescription>
          </CardContent>
        </Card>
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
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">人均月上限</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {t.perSeatCapCredits != null ? t.perSeatCapCredits.toLocaleString() : "不限"}
            </div>
            <CardDescription>每成员积分上限</CardDescription>
          </CardContent>
        </Card>
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
                {canManage ? <TableHead className="text-right">操作</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="font-medium">{m.name ?? "（未命名）"}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
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
                                  first: `确定将团队所有权转移给「${m.name ?? m.email}」？`,
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
                                first: `确定将「${m.name ?? m.email}」移出团队？其席位将被释放。`,
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
              邀请将占用一个席位名额。受邀人需用<b>相同邮箱</b>登录后在本页接受。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="invite-email">邮箱</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="member@example.com"
                />
              </div>
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
                disabled={pending || !inviteEmail.trim()}
                onClick={() =>
                  run(
                    () =>
                      inviteMemberAction(
                        buildFD({
                          tenantId: t.id,
                          email: inviteEmail,
                          role: inviteRole,
                        }),
                      ),
                    "邀请已发送",
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
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>
                      {i.email}（{ROLE_LABEL[i.role]}） · 过期 {new Date(i.expiresAt).toLocaleDateString("zh-CN")}
                    </span>
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
