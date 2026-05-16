"use client";

import { useActionState, useState } from "react";
import {
  billingActionIdle,
  publishNewSubscriptionPlanVersion,
  updateSubscriptionPlanToolsAllowlist,
  type BillingActionState,
} from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TOOL_SUITE_NAV_KEYS } from "@/lib/tool-suite-nav-keys";
import { formatPointsAsYuan } from "@/lib/currency";
import { FeedbackBanner } from "./feedback-banner";

const SUITE_LABEL: Record<string, string> = {
  "fitting-room": "试衣间",
  "text-to-image": "文生图",
  "image-to-video": "图生视频",
  "visual-lab": "视觉实验室",
  "smart-support": "AI智能客服",
  "app-history": "费用明细",
};

export type PlanRow = {
  id: string;
  slug: string;
  name: string;
  interval: "MONTH" | "YEAR";
  pricePoints: number;
  active: boolean;
  archivedAt: Date | null;
  parentPlanId: string | null;
  toolsNavAllowlist: string[];
  subscriptionsCount: number;
};

export function SubscriptionPlanCard({
  active,
  history,
}: {
  active: PlanRow;
  history: PlanRow[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-5 space-y-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h3 className="text-base font-semibold">
          {active.name}{" "}
          <span className="text-muted-foreground text-sm">({active.slug})</span>
        </h3>
        <Badge variant="secondary" className="text-xs">
          {active.interval === "YEAR" ? "年订阅" : "月订阅"}
        </Badge>
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15">
          当前生效
        </Badge>
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          当前价：
          <span className="font-semibold text-foreground">
            {active.pricePoints} 点
          </span>{" "}
          ≈ ¥{formatPointsAsYuan(active.pricePoints)}
        </span>
      </header>

      <PublishNewVersionForm plan={active} />
      <ToolsAllowlistForm plan={active} />

      {history.length > 0 && <HistoryList items={history} />}
    </div>
  );
}

function PublishNewVersionForm({ plan }: { plan: PlanRow }) {
  const [state, action, pending] = useActionState<BillingActionState, FormData>(
    publishNewSubscriptionPlanVersion,
    billingActionIdle,
  );
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="rounded-md border border-border/70 bg-background/40 p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">发布新价（停旧发新）</p>
        <p className="text-xs text-muted-foreground">
          为保留历史溯源，订阅价不可直接修改：发布即归档当前版本，老用户的订阅仍记录在旧版本上。
        </p>
      </div>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="planId" value={plan.id} />
        <div className="space-y-1">
          <Label htmlFor={`new-price-${plan.id}`} className="text-xs text-muted-foreground">
            新价（点，1 点 = ¥0.01）
          </Label>
          <Input
            id={`new-price-${plan.id}`}
            name="newPricePoints"
            type="number"
            className="w-40"
            min={0}
            required
            placeholder={String(plan.pricePoints)}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
          <input
            type="checkbox"
            name="confirm"
            value="yes"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          <span>
            我已知晓：旧版本将归档，<strong>无法恢复</strong>；老用户订阅仍可溯源旧价。
          </span>
        </label>
        <Button type="submit" size="sm" disabled={pending || !confirm}>
          {pending ? "发布中…" : "发布新版本"}
        </Button>
      </form>
      <FeedbackBanner state={state} />
    </div>
  );
}

function ToolsAllowlistForm({ plan }: { plan: PlanRow }) {
  const [state, action, pending] = useActionState<BillingActionState, FormData>(
    updateSubscriptionPlanToolsAllowlist,
    billingActionIdle,
  );
  const allowAll = plan.toolsNavAllowlist.length === 0;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="planId" value={plan.id} />
      <p className="text-xs font-medium text-muted-foreground">
        工具站套件（JWT / introspect{" "}
        <code className="font-mono">tools_nav_keys</code>）
      </p>
      <div className="flex flex-col gap-2 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="toolsAllowMode"
            value="all"
            defaultChecked={allowAll}
          />
          <span>
            订阅享有<strong>全部</strong>套件分组（白名单留空）
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="toolsAllowMode"
            value="pick"
            defaultChecked={!allowAll}
          />
          <span>仅勾选的分组（自定义）</span>
        </label>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {TOOL_SUITE_NAV_KEYS.map((key) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="toolsNavKey"
              value={key}
              defaultChecked={plan.toolsNavAllowlist.includes(key)}
            />
            <span>{SUITE_LABEL[key] ?? key}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "保存中…" : "保存套件范围"}
        </Button>
        <div className="flex-1">
          <FeedbackBanner state={state} />
        </div>
      </div>
    </form>
  );
}

function HistoryList({ items }: { items: PlanRow[] }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-md border border-border/60 bg-muted/30"
    >
      <summary className="cursor-pointer select-none px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50">
        历史版本（{items.length}）— 用于老用户订阅价溯源
      </summary>
      <div className="overflow-x-auto px-3 pb-3 pt-2">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-medium">归档 slug</th>
              <th className="py-1 pr-3 font-medium">归档时间</th>
              <th className="py-1 pr-3 font-medium tabular-nums">价格</th>
              <th className="py-1 pr-3 font-medium">≈ 元</th>
              <th className="py-1 pr-3 font-medium tabular-nums">关联订阅</th>
            </tr>
          </thead>
          <tbody>
            {items.map((h) => (
              <tr key={h.id} className="border-t border-border/60">
                <td className="py-1 pr-3 font-mono text-[11px]">{h.slug}</td>
                <td className="py-1 pr-3 text-muted-foreground">
                  {h.archivedAt
                    ? h.archivedAt.toLocaleString("zh-CN")
                    : "—"}
                </td>
                <td className="py-1 pr-3 tabular-nums">{h.pricePoints} 点</td>
                <td className="py-1 pr-3 tabular-nums">
                  ¥{formatPointsAsYuan(h.pricePoints)}
                </td>
                <td className="py-1 pr-3 tabular-nums">
                  {h.subscriptionsCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
