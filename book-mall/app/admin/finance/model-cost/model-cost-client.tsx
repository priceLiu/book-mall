"use client";

import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteModelCostAction,
  upsertModelCostAction,
} from "../credit-billing-actions";

const CHANNELS = ["CHANNEL", "OWN", "RESELLER"] as const;
const UNITS = ["PER_SEC", "PER_IMAGE", "PER_KTOKEN"] as const;
const UNIT_LABEL: Record<string, string> = {
  PER_SEC: "元/秒",
  PER_IMAGE: "元/张",
  PER_KTOKEN: "元/千token",
};
const CHANNEL_LABEL: Record<string, string> = {
  CHANNEL: "渠道折扣",
  OWN: "厂商自有",
  RESELLER: "代理转售",
};

export interface CostRow {
  id: string;
  vendor: string;
  canonicalModelKey: string;
  channel: string;
  credentialId: string | null;
  unit: string;
  tierRaw: string | null;
  listCostYuan: number;
  discountRate: number;
  netCostYuan: number;
  note: string | null;
  active: boolean;
}

const EMPTY: Omit<CostRow, "id" | "netCostYuan"> = {
  vendor: "",
  canonicalModelKey: "",
  channel: "CHANNEL",
  credentialId: null,
  unit: "PER_IMAGE",
  tierRaw: null,
  listCostYuan: 0,
  discountRate: 0,
  note: null,
  active: true,
};

export function ModelCostClient({
  profiles,
  catalogKeys,
}: {
  profiles: CostRow[];
  catalogKeys: { key: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CostRow | null>(null);
  const [draft, setDraft] = useState<Omit<CostRow, "id" | "netCostYuan">>(EMPTY);

  const netPreview = useMemo(
    () => draft.listCostYuan * (1 - Math.min(Math.max(draft.discountRate, 0), 1)),
    [draft.listCostYuan, draft.discountRate],
  );

  function startEdit(row: CostRow) {
    setEditing(row);
    setDraft({ ...row });
  }
  function startNew() {
    setEditing(null);
    setDraft(EMPTY);
  }

  function submit() {
    const fd = new FormData();
    if (editing) fd.set("id", editing.id);
    fd.set("vendor", draft.vendor);
    fd.set("canonicalModelKey", draft.canonicalModelKey);
    fd.set("channel", draft.channel);
    fd.set("unit", draft.unit);
    if (draft.tierRaw) fd.set("tierRaw", draft.tierRaw);
    if (draft.credentialId) fd.set("credentialId", draft.credentialId);
    fd.set("listCostYuan", String(draft.listCostYuan));
    fd.set("discountRate", String(draft.discountRate));
    if (draft.note) fd.set("note", draft.note);
    fd.set("active", draft.active ? "true" : "false");
    startTransition(async () => {
      const r = await upsertModelCostAction(fd);
      if (!r.ok) {
        window.alert(`保存失败：${r.error}`);
        return;
      }
      startNew();
    });
  }

  function remove(row: CostRow) {
    if (!window.confirm(`确认删除 ${row.canonicalModelKey} (${CHANNEL_LABEL[row.channel]}) 的成本档？`)) {
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", row.id);
      const r = await deleteModelCostAction(fd);
      if (!r.ok) window.alert(`删除失败：${r.error}`);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editing ? "编辑成本档" : "新增成本档"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>厂商 vendor</Label>
              <Input
                list="vendor-list"
                value={draft.vendor}
                onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
                placeholder="aliyun / kie / volcengine"
              />
              <datalist id="vendor-list">
                <option value="aliyun" />
                <option value="kie" />
                <option value="volcengine" />
                <option value="tencent" />
              </datalist>
            </div>
            <div className="space-y-1">
              <Label>归口模型键 canonicalKey</Label>
              <Input
                list="catalog-keys"
                value={draft.canonicalModelKey}
                onChange={(e) => setDraft({ ...draft, canonicalModelKey: e.target.value })}
                placeholder="seedance-720p"
              />
              <datalist id="catalog-keys">
                {catalogKeys.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label>渠道 channel</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={draft.channel}
                onChange={(e) => setDraft({ ...draft, channel: e.target.value })}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>计费单位 unit</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABEL[u]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>规格 tierRaw（可选）</Label>
              <Input
                value={draft.tierRaw ?? ""}
                onChange={(e) => setDraft({ ...draft, tierRaw: e.target.value || null })}
                placeholder="720P / 1080P / 1K"
              />
            </div>
            <div className="space-y-1">
              <Label>挂牌成本（元）</Label>
              <Input
                type="number"
                step="0.0001"
                value={draft.listCostYuan}
                onChange={(e) => setDraft({ ...draft, listCostYuan: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>折扣率（0~1，省）</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={draft.discountRate}
                onChange={(e) => setDraft({ ...draft, discountRate: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>凭证 ID（可选）</Label>
              <Input
                value={draft.credentialId ?? ""}
                onChange={(e) => setDraft({ ...draft, credentialId: e.target.value || null })}
                placeholder="多 Key 时绑定具体凭证"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>备注</Label>
            <Input value={draft.note ?? ""} onChange={(e) => setDraft({ ...draft, note: e.target.value || null })} />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              生效中
            </label>
            <span className="text-muted-foreground">
              净成本预览：<b>¥{netPreview.toFixed(4)}</b>
            </span>
          </div>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={pending}>
              {editing ? "保存修改" : "新增"}
            </Button>
            {editing ? (
              <Button variant="outline" onClick={startNew} disabled={pending}>
                取消编辑
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">成本档列表（{profiles.length}）</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>模型</TableHead>
                <TableHead>厂商/渠道</TableHead>
                <TableHead>单位</TableHead>
                <TableHead className="text-right">挂牌成本</TableHead>
                <TableHead className="text-right">折扣</TableHead>
                <TableHead className="text-right">净成本</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.canonicalModelKey}
                    {p.tierRaw ? <span className="ml-1 text-xs text-muted-foreground">{p.tierRaw}</span> : null}
                  </TableCell>
                  <TableCell>
                    {p.vendor}
                    <Badge variant="secondary" className="ml-1">
                      {CHANNEL_LABEL[p.channel]}
                    </Badge>
                  </TableCell>
                  <TableCell>{UNIT_LABEL[p.unit]}</TableCell>
                  <TableCell className="text-right">¥{p.listCostYuan.toFixed(4)}</TableCell>
                  <TableCell className="text-right">{(p.discountRate * 100).toFixed(0)}%</TableCell>
                  <TableCell className="text-right font-semibold">¥{p.netCostYuan.toFixed(4)}</TableCell>
                  <TableCell>
                    {p.active ? (
                      <Badge className="bg-emerald-600">生效</Badge>
                    ) : (
                      <Badge variant="outline">停用</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>
                      编辑
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(p)}>
                      删除
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    暂无成本档，请先新增
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
