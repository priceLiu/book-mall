"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteByokConfigAction,
  saveResourceRateAction,
  upsertByokConfigAction,
} from "../credit-billing-actions";

interface ByokConfig {
  id: string;
  scopeKey: string;
  label: string;
  techServiceFeeYuan: number;
  interval: string;
  note: string | null;
  active: boolean;
}
interface ResourceRate {
  resourceType: string;
  coefficientYuan: number;
  unitLabel: string;
  active: boolean;
}

const RESOURCE_LABEL: Record<string, string> = {
  OSS_GB_MONTH: "对象存储 OSS",
  EGRESS_GB: "出网流量",
  TASK_COUNT: "任务调度",
};
const ALL_RESOURCES = ["OSS_GB_MONTH", "EGRESS_GB", "TASK_COUNT"] as const;

const EMPTY: Omit<ByokConfig, "id"> = {
  scopeKey: "",
  label: "",
  techServiceFeeYuan: 0,
  interval: "MONTH",
  note: null,
  active: true,
};

export function ByokConfigClient({
  configs,
  rates,
}: {
  configs: ByokConfig[];
  rates: ResourceRate[];
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<ByokConfig | null>(null);
  const [draft, setDraft] = useState<Omit<ByokConfig, "id">>(EMPTY);

  const ratesByType = new Map(rates.map((r) => [r.resourceType, r]));

  function startEdit(c: ByokConfig) {
    setEditing(c);
    setDraft({ ...c });
  }
  function startNew() {
    setEditing(null);
    setDraft(EMPTY);
  }

  function submit() {
    const fd = new FormData();
    if (editing) fd.set("id", editing.id);
    fd.set("scopeKey", draft.scopeKey);
    fd.set("label", draft.label);
    fd.set("techServiceFeeYuan", String(draft.techServiceFeeYuan));
    fd.set("interval", draft.interval);
    if (draft.note) fd.set("note", draft.note);
    fd.set("active", draft.active ? "true" : "false");
    startTransition(async () => {
      const r = await upsertByokConfigAction(fd);
      if (!r.ok) window.alert(`保存失败：${r.error}`);
      else startNew();
    });
  }

  function remove(c: ByokConfig) {
    if (!window.confirm(`删除「${c.label}」技术服务费配置？`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", c.id);
      const r = await deleteByokConfigAction(fd);
      if (!r.ok) window.alert(`删除失败：${r.error}`);
    });
  }

  function saveRate(type: string, coef: number, unit: string, active: boolean) {
    const fd = new FormData();
    fd.set("resourceType", type);
    fd.set("coefficientYuan", String(coef));
    fd.set("unitLabel", unit);
    fd.set("active", active ? "true" : "false");
    startTransition(async () => {
      const r = await saveResourceRateAction(fd);
      if (!r.ok) window.alert(`保存失败：${r.error}`);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editing ? "编辑技术服务费" : "新增技术服务费"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>规格键 scopeKey</Label>
              <Input value={draft.scopeKey} onChange={(e) => setDraft({ ...draft, scopeKey: e.target.value })} placeholder="personal-standard / team-seat" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>名称</Label>
              <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>周期</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={draft.interval} onChange={(e) => setDraft({ ...draft, interval: e.target.value })}>
                <option value="MONTH">月</option>
                <option value="YEAR">年</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>技术服务费（元）</Label>
              <Input type="number" step="0.01" value={draft.techServiceFeeYuan} onChange={(e) => setDraft({ ...draft, techServiceFeeYuan: Number(e.target.value) })} />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label>备注</Label>
              <Input value={draft.note ?? ""} onChange={(e) => setDraft({ ...draft, note: e.target.value || null })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            生效
          </label>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={pending}>
              {editing ? "保存修改" : "新增"}
            </Button>
            {editing ? (
              <Button variant="outline" onClick={startNew} disabled={pending}>取消</Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">技术服务费列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {configs.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded border p-2 text-sm">
              <div>
                <span className="font-medium">{c.label}</span>
                <span className="ml-2 text-muted-foreground">{c.scopeKey}</span>
                {!c.active ? <Badge variant="outline" className="ml-2">停用</Badge> : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">¥{c.techServiceFeeYuan}/{c.interval === "YEAR" ? "年" : "月"}</span>
                <Button size="sm" variant="ghost" onClick={() => startEdit(c)}>编辑</Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(c)}>删除</Button>
              </div>
            </div>
          ))}
          {configs.length === 0 ? <div className="py-4 text-center text-muted-foreground">暂无配置</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">资源计量单价</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ALL_RESOURCES.map((type) => {
            const r = ratesByType.get(type);
            return (
              <ResourceRateRow
                key={type}
                type={type}
                label={RESOURCE_LABEL[type]}
                coef={r?.coefficientYuan ?? 0}
                unit={r?.unitLabel ?? (type === "OSS_GB_MONTH" ? "GB·月" : type === "EGRESS_GB" ? "GB" : "次")}
                active={r?.active ?? true}
                pending={pending}
                onSave={saveRate}
              />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function ResourceRateRow({
  type,
  label,
  coef,
  unit,
  active,
  pending,
  onSave,
}: {
  type: string;
  label: string;
  coef: number;
  unit: string;
  active: boolean;
  pending: boolean;
  onSave: (type: string, coef: number, unit: string, active: boolean) => void;
}) {
  const [c, setC] = useState(coef);
  const [u, setU] = useState(unit);
  const [a, setA] = useState(active);
  return (
    <div className="flex flex-wrap items-end gap-2 rounded border p-2">
      <div className="min-w-[120px] font-medium">{label}</div>
      <div className="space-y-1">
        <Label className="text-xs">单价（元）</Label>
        <Input className="h-8 w-28" type="number" step="0.00000001" value={c} onChange={(e) => setC(Number(e.target.value))} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">单位</Label>
        <Input className="h-8 w-24" value={u} onChange={(e) => setU(e.target.value)} />
      </div>
      <label className="flex items-center gap-1 text-sm">
        <input type="checkbox" checked={a} onChange={(e) => setA(e.target.checked)} /> 生效
      </label>
      <Button size="sm" variant="outline" onClick={() => onSave(type, c, u, a)} disabled={pending}>
        保存
      </Button>
    </div>
  );
}
