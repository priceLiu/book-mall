"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteMembershipPlanAction,
  deleteSeatTierAction,
  upsertMembershipPlanAction,
  upsertSeatTierAction,
} from "../credit-billing-actions";

interface SeatTier {
  id: string;
  planId: string;
  seatMin: number;
  seatMax: number | null;
  perSeatPriceYuan: number;
  perSeatCredits: number;
  sortOrder: number;
}
interface Plan {
  id: string;
  family: string;
  interval: string;
  tier: string;
  sortOrder: number;
  priceYuan: number;
  originalYuan: number | null;
  promoLabel: string | null;
  monthlyCredits: number;
  includedSeats: number;
  active: boolean;
  seatTiers: SeatTier[];
}

const FAMILY_LABEL: Record<string, string> = { PERSONAL: "个人", TEAM: "团队" };
const INTERVAL_LABEL: Record<string, string> = { MONTH: "月付", YEAR: "年付" };

const EMPTY_PLAN: Omit<Plan, "id" | "seatTiers"> = {
  family: "PERSONAL",
  interval: "MONTH",
  tier: "标准版",
  sortOrder: 1,
  priceYuan: 0,
  originalYuan: null,
  promoLabel: null,
  monthlyCredits: 0,
  includedSeats: 1,
  active: true,
};

export function MembershipPlansClient({ plans }: { plans: Plan[] }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [draft, setDraft] = useState<Omit<Plan, "id" | "seatTiers">>(EMPTY_PLAN);

  function startEdit(p: Plan) {
    setEditing(p);
    setDraft({ ...p });
  }
  function startNew() {
    setEditing(null);
    setDraft(EMPTY_PLAN);
  }

  function submitPlan() {
    const fd = new FormData();
    if (editing) fd.set("id", editing.id);
    fd.set("family", draft.family);
    fd.set("interval", draft.interval);
    fd.set("tier", draft.tier);
    fd.set("sortOrder", String(draft.sortOrder));
    fd.set("priceYuan", String(draft.priceYuan));
    if (draft.originalYuan != null) fd.set("originalYuan", String(draft.originalYuan));
    if (draft.promoLabel) fd.set("promoLabel", draft.promoLabel);
    fd.set("monthlyCredits", String(draft.monthlyCredits));
    fd.set("includedSeats", String(draft.includedSeats));
    fd.set("active", draft.active ? "true" : "false");
    startTransition(async () => {
      const r = await upsertMembershipPlanAction(fd);
      if (!r.ok) window.alert(`保存失败：${r.error}`);
      else startNew();
    });
  }

  function removePlan(p: Plan) {
    if (!window.confirm(`确认删除套餐「${FAMILY_LABEL[p.family]}·${INTERVAL_LABEL[p.interval]}·${p.tier}」？`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", p.id);
      const r = await deleteMembershipPlanAction(fd);
      if (!r.ok) window.alert(`删除失败：${r.error}`);
    });
  }

  const grouped = plans.reduce<Record<string, Plan[]>>((acc, p) => {
    const k = `${p.family}-${p.interval}`;
    (acc[k] ||= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editing ? "编辑套餐" : "新增套餐"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>类型</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={draft.family} onChange={(e) => setDraft({ ...draft, family: e.target.value })}>
                <option value="PERSONAL">个人</option>
                <option value="TEAM">团队</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>周期</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={draft.interval} onChange={(e) => setDraft({ ...draft, interval: e.target.value })}>
                <option value="MONTH">月付</option>
                <option value="YEAR">年付</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>档位</Label>
              <Input value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value })} placeholder="标准版/进阶版/..." />
            </div>
            <div className="space-y-1">
              <Label>排序</Label>
              <Input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>价格（元）</Label>
              <Input type="number" step="0.01" value={draft.priceYuan} onChange={(e) => setDraft({ ...draft, priceYuan: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>划线原价（可选）</Label>
              <Input type="number" step="0.01" value={draft.originalYuan ?? ""} onChange={(e) => setDraft({ ...draft, originalYuan: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div className="space-y-1">
              <Label>月积分（团队=每席）</Label>
              <Input type="number" value={draft.monthlyCredits} onChange={(e) => setDraft({ ...draft, monthlyCredits: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>含席位数</Label>
              <Input type="number" value={draft.includedSeats} onChange={(e) => setDraft({ ...draft, includedSeats: Number(e.target.value) })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>促销标签（可选）</Label>
            <Input value={draft.promoLabel ?? ""} onChange={(e) => setDraft({ ...draft, promoLabel: e.target.value || null })} placeholder="限时67折 / 年付立省2个月" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            上架
          </label>
          <div className="flex gap-2">
            <Button onClick={submitPlan} disabled={pending}>
              {editing ? "保存修改" : "新增套餐"}
            </Button>
            {editing ? (
              <Button variant="outline" onClick={startNew} disabled={pending}>
                取消
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {Object.entries(grouped).map(([key, list]) => {
        const [family, interval] = key.split("-");
        return (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-base">
                {FAMILY_LABEL[family]} · {INTERVAL_LABEL[interval]}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {list.map((p) => (
                <div key={p.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{p.tier}</span>
                      <span className="ml-2 text-lg font-bold">¥{p.priceYuan}</span>
                      {p.originalYuan ? <span className="ml-1 text-sm text-muted-foreground line-through">¥{p.originalYuan}</span> : null}
                      {p.promoLabel ? <Badge className="ml-2 bg-rose-500">{p.promoLabel}</Badge> : null}
                      {!p.active ? <Badge variant="outline" className="ml-2">下架</Badge> : null}
                      <div className="text-xs text-muted-foreground">
                        月积分 {p.monthlyCredits.toLocaleString()} · 含 {p.includedSeats} 席
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>编辑</Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removePlan(p)}>删除</Button>
                    </div>
                  </div>
                  {family === "TEAM" ? (
                    <SeatTiersEditor planId={p.id} tiers={p.seatTiers} pending={pending} startTransition={startTransition} />
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SeatTiersEditor({
  planId,
  tiers,
  pending,
  startTransition,
}: {
  planId: string;
  tiers: SeatTier[];
  pending: boolean;
  startTransition: (cb: () => void) => void;
}) {
  const [seatMin, setSeatMin] = useState(1);
  const [seatMax, setSeatMax] = useState<string>("");
  const [price, setPrice] = useState(0);
  const [credits, setCredits] = useState(0);

  function add() {
    const fd = new FormData();
    fd.set("planId", planId);
    fd.set("seatMin", String(seatMin));
    if (seatMax) fd.set("seatMax", seatMax);
    fd.set("perSeatPriceYuan", String(price));
    fd.set("perSeatCredits", String(credits));
    fd.set("sortOrder", String(tiers.length + 1));
    startTransition(async () => {
      const r = await upsertSeatTierAction(fd);
      if (!r.ok) window.alert(`保存失败：${r.error}`);
    });
  }
  function remove(id: string) {
    if (!window.confirm("删除该席位带？")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const r = await deleteSeatTierAction(fd);
      if (!r.ok) window.alert(`删除失败：${r.error}`);
    });
  }

  return (
    <div className="mt-3 space-y-2 rounded bg-muted/30 p-2">
      <div className="text-xs font-medium text-purple-600">席位带（紫色：每席单价随人数变化）</div>
      {tiers.map((t) => (
        <div key={t.id} className="flex items-center justify-between text-sm">
          <span>
            {t.seatMin}{t.seatMax ? `–${t.seatMax}` : "+"} 人 · ¥{t.perSeatPriceYuan}/席 · {t.perSeatCredits.toLocaleString()} 积分/席
          </span>
          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(t.id)}>删除</Button>
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">起</Label>
          <Input className="h-8 w-16" type="number" value={seatMin} onChange={(e) => setSeatMin(Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">止(空=不封顶)</Label>
          <Input className="h-8 w-20" type="number" value={seatMax} onChange={(e) => setSeatMax(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">¥/席</Label>
          <Input className="h-8 w-20" type="number" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">积分/席</Label>
          <Input className="h-8 w-24" type="number" value={credits} onChange={(e) => setCredits(Number(e.target.value))} />
        </div>
        <Button size="sm" variant="outline" onClick={add} disabled={pending}>新增席位带</Button>
      </div>
    </div>
  );
}
