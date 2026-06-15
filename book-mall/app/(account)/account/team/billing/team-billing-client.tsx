"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
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

import { maskPhone } from "@/lib/auth/phone";

interface ByModel {
  canonicalModelKey: string;
  credits: number;
  count: number;
}
interface MemberUsage {
  actorUserId: string;
  name: string | null;
  phone: string | null;
  consumed: number;
  count: number;
  byModel: ByModel[];
}
interface TeamBill {
  periodKey: string;
  granted: number;
  consumed: number;
  refunded: number;
  topup: number;
  net: number;
  balanceCredits: number;
  monthlyGrantCredits: number;
  perSeatCapCredits: number | null;
  byModel: ByModel[];
  members: MemberUsage[];
}

function fmt(n: number): string {
  return new Intl.NumberFormat("zh-CN").format(Math.round(n));
}

/** 1 积分 = ¥0.04（锚定价），用于参考金额展示。 */
function yuan(credits: number): string {
  return `¥${(credits * 0.04).toFixed(2)}`;
}

function downloadCsv(filename: string, rows: string[][]): void {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const content = rows.map((r) => r.map(escape).join(",")).join("\r\n");
  // 前置 BOM，避免 Excel 中文乱码
  const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function TeamBillingClient(props: {
  hasTeam: boolean;
  canView: boolean;
  tenantName: string | null;
  period: string;
  periods: string[];
  bill: TeamBill | null;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  const memberCsv = useMemo(() => {
    if (!props.bill) return [] as string[][];
    const header = ["成员", "手机号", "消耗积分", "参考金额(¥)", "生成次数", "占比%"];
    const total = props.bill.consumed || 1;
    const rows = props.bill.members.map((m) => [
      m.name ?? m.actorUserId,
      m.phone ? maskPhone(m.phone) : "",
      String(Math.round(m.consumed)),
      (m.consumed * 0.04).toFixed(2),
      String(m.count),
      ((m.consumed / total) * 100).toFixed(1),
    ]);
    return [header, ...rows];
  }, [props.bill]);

  if (!props.hasTeam) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>暂无团队</CardTitle>
          <CardDescription>
            你还没有加入或开通团队空间。请先在「团队空间」开通团队版后再查看团队账单。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!props.canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>无权查看</CardTitle>
          <CardDescription>
            团队账单仅对主账号（OWNER）与管理员（ADMIN）开放。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const bill = props.bill;

  return (
    <div className="flex flex-col gap-4">
      {/* 周期选择 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">账期：</span>
        {props.periods.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={p === props.period ? "default" : "outline"}
            onClick={() => router.push(`/account/team/billing?period=${p}`)}
          >
            {p}
          </Button>
        ))}
        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            disabled={!bill || bill.members.length === 0}
            onClick={() =>
              downloadCsv(
                `团队账单-${props.tenantName ?? "team"}-${props.period}.csv`,
                memberCsv,
              )
            }
          >
            导出成员明细 CSV
          </Button>
        </div>
      </div>

      {/* 一句话结论 + 总账卡 */}
      <Card>
        <CardHeader>
          <CardTitle>
            {props.tenantName ?? "团队"} · {props.period} 总账
          </CardTitle>
          <CardDescription>
            本月发放 {fmt(bill?.granted ?? 0)} 积分，消耗 {fmt(bill?.consumed ?? 0)}{" "}
            积分（约 {yuan(bill?.consumed ?? 0)}），当前共享池剩余{" "}
            {fmt(bill?.balanceCredits ?? 0)} 积分。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="发放(GRANT)" value={fmt(bill?.granted ?? 0)} />
            <Stat label="消耗(CONSUME)" value={fmt(bill?.consumed ?? 0)} />
            <Stat label="返还(REFUND)" value={fmt(bill?.refunded ?? 0)} />
            <Stat label="充值(TOPUP)" value={fmt(bill?.topup ?? 0)} />
            <Stat label="期末净额" value={fmt(bill?.net ?? 0)} />
            <Stat label="共享池余额" value={fmt(bill?.balanceCredits ?? 0)} />
            <Stat label="月发放额" value={fmt(bill?.monthlyGrantCredits ?? 0)} />
            <Stat
              label="人均上限"
              value={
                bill?.perSeatCapCredits != null
                  ? fmt(bill.perSeatCapCredits)
                  : "不限"
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 按模型 */}
      <Card>
        <CardHeader>
          <CardTitle>按模型消耗</CardTitle>
          <CardDescription>积分按模型归口拆分（canonicalModelKey）。</CardDescription>
        </CardHeader>
        <CardContent>
          {bill && bill.byModel.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>模型</TableHead>
                  <TableHead className="text-right">次数</TableHead>
                  <TableHead className="text-right">消耗积分</TableHead>
                  <TableHead className="text-right">参考金额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bill.byModel.map((m) => (
                  <TableRow key={m.canonicalModelKey}>
                    <TableCell className="font-mono text-xs">
                      {m.canonicalModelKey}
                    </TableCell>
                    <TableCell className="text-right">{fmt(m.count)}</TableCell>
                    <TableCell className="text-right">{fmt(m.credits)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {yuan(m.credits)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">本月暂无消耗记录。</p>
          )}
        </CardContent>
      </Card>

      {/* 按成员下钻 */}
      <Card>
        <CardHeader>
          <CardTitle>按成员消耗（下钻）</CardTitle>
          <CardDescription>
            点击成员行展开其按模型明细；积分记录归属到实际操作成员（actorUserId）。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bill && bill.members.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>成员</TableHead>
                  <TableHead className="text-right">生成次数</TableHead>
                  <TableHead className="text-right">消耗积分</TableHead>
                  <TableHead className="text-right">参考金额</TableHead>
                  <TableHead className="text-right">占比</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bill.members.map((m) => {
                  const pct =
                    bill.consumed > 0
                      ? ((m.consumed / bill.consumed) * 100).toFixed(1)
                      : "0.0";
                  const open = expanded === m.actorUserId;
                  return (
                    <Fragment key={m.actorUserId}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() =>
                          setExpanded(open ? null : m.actorUserId)
                        }
                      >
                        <TableCell>
                          <span className="mr-1 inline-block w-3 text-muted-foreground">
                            {open ? "▾" : "▸"}
                          </span>
                          {m.name ?? (m.phone ? maskPhone(m.phone) : m.actorUserId)}
                          {m.phone ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {maskPhone(m.phone)}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">{fmt(m.count)}</TableCell>
                        <TableCell className="text-right">{fmt(m.consumed)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {yuan(m.consumed)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{pct}%</Badge>
                        </TableCell>
                      </TableRow>
                      {open
                        ? m.byModel.map((bm) => (
                            <TableRow
                              key={`${m.actorUserId}:${bm.canonicalModelKey}`}
                              className="bg-muted/30"
                            >
                              <TableCell className="pl-8 font-mono text-xs">
                                {bm.canonicalModelKey}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {fmt(bm.count)}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {fmt(bm.credits)}
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                {yuan(bm.credits)}
                              </TableCell>
                              <TableCell />
                            </TableRow>
                          ))
                        : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">本月暂无成员消耗记录。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="mt-1 text-lg font-semibold">{props.value}</div>
    </div>
  );
}
