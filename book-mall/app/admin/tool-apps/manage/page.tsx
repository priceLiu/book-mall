import { prisma } from "@/lib/prisma";
import {
  createToolBillablePrice,
  updateToolBillablePrice,
  updateToolNavVisibility,
} from "@/app/actions/tool-apps-admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = {
  title: "工具管理 — 管理后台",
};

function formatDatetimeLocalChina(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

export default async function AdminToolAppsManagePage() {
  const [navRows, prices] = await Promise.all([
    prisma.toolNavVisibility.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.toolBillablePrice.findMany({
      orderBy: [{ toolKey: "asc" }, { effectiveFrom: "desc" }],
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">工具管理</h1>
        <p className="text-sm text-muted-foreground">
          配置工具站左侧菜单是否展示，以及按次计费单价（与{" "}
          <code className="text-xs">ToolBillablePrice</code> 一致）。试衣间实际计费入口为{" "}
          <strong>AI试衣页</strong>（<code className="text-xs">fitting-room__ai-fit</code> +{" "}
          <code className="text-xs">try_on</code>）；套装 / 衣柜等路径不产生该项自动单价。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>菜单可见性</CardTitle>
          <CardDescription>
            关闭后，工具站侧栏将隐藏对应入口（仅隐藏导航，不拦截直接访问 URL）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {navRows.map((row) => (
            <form
              key={row.navKey}
              action={updateToolNavVisibility}
              className="flex flex-wrap items-center gap-4 rounded-lg border border-secondary/80 p-4"
            >
              <input type="hidden" name="navKey" value={row.navKey} />
              <div className="min-w-[10rem] flex-1">
                <div className="font-medium">{row.label}</div>
                <div className="font-mono text-xs text-muted-foreground">{row.navKey}</div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="visible"
                  defaultChecked={row.visible}
                  className="h-4 w-4 rounded border-input"
                />
                在工具站菜单中展示
              </label>
              <Button type="submit" size="sm" variant="secondary">
                保存
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>按次单价</CardTitle>
          <CardDescription>
            单位为元（保存时换算为分）；约定示例 — 试衣间大模型扣费挂在{" "}
            <code className="text-xs">fitting-room__ai-fit</code> +{" "}
            <code className="text-xs">try_on</code>。空 <code className="text-xs">action</code>{" "}
            表示该工具下通配。时间按 <strong>北京时间</strong> 填写。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="overflow-x-auto rounded-lg border border-secondary">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-secondary bg-muted/50">
                <tr>
                  <th className="p-2 font-medium">定价条目（toolKey / action 只读；其余可改）</th>
                </tr>
              </thead>
              <tbody>
                {prices.length === 0 ? (
                  <tr>
                    <td className="p-4 text-muted-foreground">
                      暂无定价；请在下方新增。
                    </td>
                  </tr>
                ) : (
                  prices.map((p) => (
                    <tr key={p.id} className="border-b border-secondary/70 align-top last:border-0">
                      <td className="p-3">
                        <form
                          action={updateToolBillablePrice}
                          className="flex flex-wrap items-end gap-3 gap-y-4"
                        >
                          <input type="hidden" name="id" value={p.id} />
                          <div className="min-w-[10rem] max-w-[14rem]">
                            <div className="text-xs text-muted-foreground">toolKey</div>
                            <div className="break-all font-mono text-xs">{p.toolKey}</div>
                          </div>
                          <div className="min-w-[5rem]">
                            <div className="text-xs text-muted-foreground">action</div>
                            <div className="font-mono text-xs">{p.action ?? "—"}</div>
                          </div>
                          <div className="w-[7rem]">
                            <Label className="text-xs text-muted-foreground">单价(元)</Label>
                            <Input
                              name="priceYuan"
                              type="number"
                              step="0.01"
                              min={0}
                              required
                              defaultValue={(p.priceMinor / 100).toFixed(2)}
                              className="mt-1 h-9 font-mono text-xs"
                            />
                          </div>
                          <div className="w-[11rem]">
                            <Label className="text-xs text-muted-foreground">生效起</Label>
                            <Input
                              name="effectiveFrom"
                              type="datetime-local"
                              required
                              defaultValue={formatDatetimeLocalChina(p.effectiveFrom)}
                              className="mt-1 h-9 font-mono text-xs"
                            />
                          </div>
                          <div className="w-[11rem]">
                            <Label className="text-xs text-muted-foreground">生效止（空=长期）</Label>
                            <Input
                              name="effectiveTo"
                              type="datetime-local"
                              defaultValue={
                                p.effectiveTo ? formatDatetimeLocalChina(p.effectiveTo) : ""
                              }
                              className="mt-1 h-9 font-mono text-xs"
                            />
                          </div>
                          <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs">
                            <input
                              type="checkbox"
                              name="active"
                              defaultChecked={p.active}
                              className="h-4 w-4 rounded border-input"
                            />
                            启用
                          </label>
                          <div className="min-w-[10rem] flex-1">
                            <Label className="text-xs text-muted-foreground">备注</Label>
                            <Input
                              name="note"
                              defaultValue={p.note ?? ""}
                              className="mt-1 h-9 text-xs"
                              placeholder="可选"
                            />
                          </div>
                          <Button type="submit" size="sm" className="shrink-0">
                            保存
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-dashed border-secondary p-4">
            <h3 className="mb-3 text-sm font-semibold">新增定价</h3>
            <form action={createToolBillablePrice} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="new-toolKey">toolKey</Label>
                <Input
                  id="new-toolKey"
                  name="toolKey"
                  required
                  placeholder="fitting-room__ai-fit（AI试衣页）或 text-to-image"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label htmlFor="new-action">action（可空=通配）</Label>
                <Input
                  id="new-action"
                  name="action"
                  placeholder="如 try_on、invoke"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label htmlFor="new-price">单价（元）</Label>
                <Input
                  id="new-price"
                  name="priceYuan"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  placeholder="1 或 0.5"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="new-from">生效起（北京时间）</Label>
                <Input id="new-from" name="effectiveFrom" type="datetime-local" required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="new-to">生效止（留空=长期）</Label>
                <Input id="new-to" name="effectiveTo" type="datetime-local" className="mt-1" />
              </div>
              <div className="flex items-center gap-2 pb-2 sm:col-span-2">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked
                  className="h-4 w-4 rounded border-input"
                  id="new-active"
                />
                <Label htmlFor="new-active" className="font-normal">
                  启用
                </Label>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="new-note">备注</Label>
                <Input id="new-note" name="note" className="mt-1" placeholder="可选" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">添加</Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
