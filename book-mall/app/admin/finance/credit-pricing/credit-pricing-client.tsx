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
  computeCreditPrice,
  computeEffectiveMargin,
  computeTierGenerations,
  unitLabel,
  type PricingConfig,
} from "@/lib/pricing/credit-pricing-formulas";
import {
  publishModelPriceAction,
  savePricingConfigAction,
  unpublishModelPriceAction,
} from "../credit-billing-actions";

interface ModelInput {
  canonicalModelKey: string;
  vendor: string;
  channel: string;
  unit: string;
  tierRaw: string | null;
  listCostYuan: number;
  discountRate: number;
  netCostYuan: number;
}
interface PublishedPrice {
  canonicalModelKey: string;
  displayName: string;
  unit: string;
  creditsPerUnit: number;
  listPriceYuan: number;
  baseMarginRate: number;
  marginM: number;
  active: boolean;
  publishedAt: string;
}
interface PlanLite {
  family: string;
  interval: string;
  tier: string;
  priceYuan: number;
  monthlyCredits: number;
}

export function CreditPricingClient({
  config,
  models,
  published,
  plans,
}: {
  config: PricingConfig;
  models: ModelInput[];
  published: PublishedPrice[];
  plans: PlanLite[];
}) {
  const [pending, startTransition] = useTransition();
  const [anchor, setAnchor] = useState(config.creditAnchorYuan);
  const [marginM, setMarginM] = useState(config.defaultMarginM);
  const [minGuard, setMinGuard] = useState(config.minMarginGuard);
  const [videoSec, setVideoSec] = useState(config.defaultVideoSec);

  const [selectedKey, setSelectedKey] = useState(models[0]?.canonicalModelKey ?? "");
  const [displayName, setDisplayName] = useState("");

  const selected = models.find((m) => m.canonicalModelKey === selectedKey);

  const comp = useMemo(() => {
    if (!selected) return null;
    return computeCreditPrice({
      listCostYuan: selected.listCostYuan,
      discountRate: selected.discountRate,
      marginM,
      anchorYuan: anchor,
    });
  }, [selected, marginM, anchor]);

  const belowGuard = comp ? comp.baseMarginRate < minGuard : false;

  // 个人套餐用于「各档生成次数」预览
  const personalPlans = plans.filter((p) => p.family === "PERSONAL" && p.interval === "MONTH");

  function saveConfig() {
    const fd = new FormData();
    fd.set("creditAnchorYuan", String(anchor));
    fd.set("defaultMarginM", String(marginM));
    fd.set("minMarginGuard", String(minGuard));
    fd.set("defaultVideoSec", String(videoSec));
    startTransition(async () => {
      const r = await savePricingConfigAction(fd);
      if (!r.ok) window.alert(`保存失败：${r.error}`);
      else window.alert("全局参数已保存");
    });
  }

  function publish() {
    if (!selected) return;
    if (belowGuard && !window.confirm("当前毛利低于护栏阈值，发布会被拦截。仍要尝试？")) return;
    const fd = new FormData();
    fd.set("canonicalModelKey", selected.canonicalModelKey);
    fd.set("displayName", displayName || selected.canonicalModelKey);
    fd.set("marginM", String(marginM));
    startTransition(async () => {
      const r = await publishModelPriceAction(fd);
      if (!r.ok) window.alert(`发布失败：${r.error}`);
      else window.alert("已发布到对外报价");
    });
  }

  function unpublish(key: string) {
    if (!window.confirm(`确认下架 ${key} 的对外报价？`)) return;
    const fd = new FormData();
    fd.set("canonicalModelKey", key);
    startTransition(async () => {
      const r = await unpublishModelPriceAction(fd);
      if (!r.ok) window.alert(`下架失败：${r.error}`);
    });
  }

  function exportCsv() {
    const header = ["模型", "厂商", "单位", "挂牌价(元)", "积分/单位", "标准毛利", "系数M", "状态", "发布时间"];
    const rows = published.map((p) => [
      p.canonicalModelKey,
      p.displayName,
      unitLabel(p.unit),
      p.listPriceYuan.toFixed(4),
      String(p.creditsPerUnit),
      `${(p.baseMarginRate * 100).toFixed(1)}%`,
      String(p.marginM),
      p.active ? "上架" : "下架",
      p.publishedAt,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credit-pricing-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">全局计费参数</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>积分锚定（元/积分）</Label>
              <Input type="number" step="0.001" value={anchor} onChange={(e) => setAnchor(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>默认系数 M</Label>
              <Input type="number" step="0.1" value={marginM} onChange={(e) => setMarginM(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>毛利护栏（0~1）</Label>
              <Input type="number" step="0.01" value={minGuard} onChange={(e) => setMinGuard(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>视频默认秒数</Label>
              <Input type="number" step="1" value={videoSec} onChange={(e) => setVideoSec(Number(e.target.value))} />
            </div>
          </div>
          <div className="mt-3">
            <Button variant="outline" onClick={saveConfig} disabled={pending}>
              保存全局参数
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">报价计算器</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>选择模型（来自生效成本档）</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                >
                  {models.map((m) => (
                    <option key={m.canonicalModelKey} value={m.canonicalModelKey}>
                      {m.canonicalModelKey}（{m.vendor} · 净成本 ¥{m.netCostYuan.toFixed(4)}）
                    </option>
                  ))}
                  {models.length === 0 ? <option value="">（无成本档，请先到「模型成本」新增）</option> : null}
                </select>
              </div>
              <div className="space-y-1">
                <Label>对外显示名</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={selected?.canonicalModelKey ?? ""}
                />
              </div>
              {selected ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="text-muted-foreground">净成本 C = ¥{selected.listCostYuan.toFixed(4)} × (1 − {(selected.discountRate * 100).toFixed(0)}%) = <b>¥{selected.netCostYuan.toFixed(4)}</b></div>
                </div>
              ) : null}
            </div>

            {comp && selected ? (
              <div className="space-y-2 rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">挂牌价 P = C × {marginM}</span>
                  <b>¥{comp.listPriceYuan.toFixed(4)}</b>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">积分/{unitLabel(selected.unit)} U = round(P ÷ {anchor})</span>
                  <b className="text-lg">{comp.creditsPerUnit} 积分</b>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">标准毛利 g</span>
                  <b className={belowGuard ? "text-red-600" : "text-emerald-600"}>
                    {(comp.baseMarginRate * 100).toFixed(1)}%
                  </b>
                </div>
                {belowGuard ? (
                  <div className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 dark:bg-red-950/40">
                    低于护栏 {(minGuard * 100).toFixed(0)}%，发布将被拦截
                  </div>
                ) : null}
                <div className="pt-2">
                  <Button onClick={publish} disabled={pending || !selected}>
                    发布到对外报价
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {comp && selected && personalPlans.length > 0 ? (
            <div>
              <div className="mb-2 text-sm font-medium">个人·月付各档可生成次数（按本模型 {comp.creditsPerUnit} 积分/{unitLabel(selected.unit)}）</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>档位</TableHead>
                    <TableHead className="text-right">月积分</TableHead>
                    <TableHead className="text-right">可生成</TableHead>
                    <TableHead className="text-right">每积分售价</TableHead>
                    <TableHead className="text-right">实际毛利</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personalPlans.map((pl) => {
                    const gen = computeTierGenerations(pl.monthlyCredits, comp.creditsPerUnit);
                    const pricePerCredit = pl.monthlyCredits > 0 ? pl.priceYuan / pl.monthlyCredits : anchor;
                    const eff = computeEffectiveMargin({
                      netCostYuan: selected.netCostYuan,
                      creditsPerUnit: comp.creditsPerUnit,
                      pricePerCreditYuan: pricePerCredit,
                    });
                    return (
                      <TableRow key={pl.tier}>
                        <TableCell>{pl.tier}</TableCell>
                        <TableCell className="text-right">{pl.monthlyCredits.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">{gen.toLocaleString()} {unitLabel(selected.unit)}</TableCell>
                        <TableCell className="text-right">¥{pricePerCredit.toFixed(4)}</TableCell>
                        <TableCell className={`text-right ${eff < minGuard ? "text-red-600" : "text-emerald-600"}`}>
                          {(eff * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">已发布报价（{published.length}）</CardTitle>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={published.length === 0}>
            导出 CSV
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>模型</TableHead>
                <TableHead className="text-right">挂牌价</TableHead>
                <TableHead className="text-right">积分/单位</TableHead>
                <TableHead className="text-right">标准毛利</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {published.map((p) => (
                <TableRow key={p.canonicalModelKey}>
                  <TableCell className="font-medium">
                    {p.displayName}
                    <span className="ml-1 text-xs text-muted-foreground">{p.canonicalModelKey}</span>
                  </TableCell>
                  <TableCell className="text-right">¥{p.listPriceYuan.toFixed(4)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {p.creditsPerUnit} / {unitLabel(p.unit)}
                  </TableCell>
                  <TableCell className="text-right">{(p.baseMarginRate * 100).toFixed(1)}%</TableCell>
                  <TableCell>
                    {p.active ? <Badge className="bg-emerald-600">上架</Badge> : <Badge variant="outline">下架</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.active ? (
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => unpublish(p.canonicalModelKey)}>
                        下架
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {published.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    暂无发布报价
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
