import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TOOL_NAV_LABEL } from "@/lib/tool-nav-labels";
import { formatPointsAsYuan } from "@/lib/currency";
import { updateToolServiceFeePlanAction } from "@/app/actions/tool-service-fee-admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = {
  title: "工具技术服务费 — 管理后台",
};

export default async function AdminToolServiceFeePage() {
  const plans = await prisma.toolServiceFeePlan.findMany({
    orderBy: [{ sortOrder: "asc" }, { toolNavKey: "asc" }],
  });

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/admin/tool-apps/manage" className="text-primary underline">
            ← 工具管理
          </Link>
        </p>
        <h1 className="text-2xl font-bold">工具技术服务费定价</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Phase D：用户开通/续订工具时从钱包扣「月费点数」，延长 30 天服务期。单次 AI 生成不另扣点（走 Gateway BYOK）。
          详见{" "}
          <code className="text-xs">doc/logic/tool-monthly-service-fee.md</code>。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">定价表</CardTitle>
          <CardDescription className="text-xs">
            toolNavKey 与工具站 SSO 分组一致；0 点表示免费分组（如费用明细）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {plans.map((p) => (
            <form
              key={p.id}
              action={updateToolServiceFeePlanAction}
              className="space-y-3 rounded-lg border border-border/60 p-4"
            >
              <input type="hidden" name="id" value={p.id} />
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-medium">{p.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {p.toolNavKey}
                  {TOOL_NAV_LABEL[p.toolNavKey] ? ` · ${TOOL_NAV_LABEL[p.toolNavKey]}` : ""}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor={`label-${p.id}`}>展示名</Label>
                  <Input id={`label-${p.id}`} name="label" defaultValue={p.label} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`fee-${p.id}`}>月费（点）</Label>
                  <Input
                    id={`fee-${p.id}`}
                    name="monthlyFeePoints"
                    type="number"
                    min={0}
                    defaultValue={p.monthlyFeePoints}
                  />
                  <p className="text-xs text-muted-foreground tabular-nums">
                    ≈ ¥{formatPointsAsYuan(p.monthlyFeePoints)} / 30 天
                  </p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor={`note-${p.id}`}>备注</Label>
                  <Input id={`note-${p.id}`} name="note" defaultValue={p.note ?? ""} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="active" defaultChecked={p.active} />
                  允许开通
                </label>
                <Button type="submit" size="sm">
                  保存
                </Button>
              </div>
            </form>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
