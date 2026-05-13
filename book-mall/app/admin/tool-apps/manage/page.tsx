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
          前台工具「按次扣费」单价<strong className="text-foreground">仅此页维护</strong>
          （产品管理不再标价）。配置工具站左侧菜单是否展示，以及按次计费单价（与{" "}
          <code className="text-xs">ToolBillablePrice</code> 一致）。试衣间实际计费入口为{" "}
          <strong>AI智能试衣页</strong>（<code className="text-xs">fitting-room__ai-fit</code> +{" "}
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
          <div className="hidden" aria-hidden="true">
            {prices.map((p) => (
              <form key={`upd-${p.id}`} id={`upd-tool-price-${p.id}`} action={updateToolBillablePrice}>
                <input type="hidden" name="id" value={p.id} />
              </form>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-secondary">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="border-b border-secondary bg-muted/50">
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="p-2 font-medium normal-case tracking-normal text-foreground">toolKey</th>
                  <th className="p-2 font-medium normal-case tracking-normal text-foreground">action</th>
                  <th className="p-2 font-medium normal-case tracking-normal text-foreground w-[100px]">
                    单价(元)
                  </th>
                  <th className="p-2 font-medium normal-case tracking-normal text-foreground w-[168px]">
                    生效起
                  </th>
                  <th className="p-2 font-medium normal-case tracking-normal text-foreground w-[168px]">
                    生效止
                  </th>
                  <th className="p-2 font-medium normal-case tracking-normal text-foreground w-[64px] text-center">
                    启用
                  </th>
                  <th className="p-2 font-medium normal-case tracking-normal text-foreground min-w-[12rem]">
                    备注
                  </th>
                  <th className="p-2 font-medium normal-case tracking-normal text-foreground w-[76px]" />
                </tr>
              </thead>
              <tbody>
                {prices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-muted-foreground">
                      暂无定价；请在下方新增。
                    </td>
                  </tr>
                ) : (
                  prices.map((p) => {
                    const fid = `upd-tool-price-${p.id}`;
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-secondary/70 align-middle last:border-0 hover:bg-muted/20"
                      >
                        <td className="p-2 align-top">
                          <span className="break-all font-mono text-xs leading-snug">{p.toolKey}</span>
                        </td>
                        <td className="p-2 align-top font-mono text-xs">{p.action ?? "—"}</td>
                        <td className="p-2">
                          <Input
                            form={fid}
                            name="priceYuan"
                            type="number"
                            step="0.01"
                            min={0}
                            required
                            defaultValue={(p.priceMinor / 100).toFixed(2)}
                            className="h-9 font-mono text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            form={fid}
                            name="effectiveFrom"
                            type="datetime-local"
                            required
                            defaultValue={formatDatetimeLocalChina(p.effectiveFrom)}
                            className="h-9 font-mono text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            form={fid}
                            name="effectiveTo"
                            type="datetime-local"
                            defaultValue={
                              p.effectiveTo ? formatDatetimeLocalChina(p.effectiveTo) : ""
                            }
                            className="h-9 font-mono text-xs"
                            title="留空表示长期有效"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            form={fid}
                            type="checkbox"
                            name="active"
                            defaultChecked={p.active}
                            className="h-4 w-4 rounded border-input align-middle"
                            aria-label="启用"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            form={fid}
                            name="note"
                            defaultValue={p.note ?? ""}
                            className="h-9 text-xs"
                            placeholder="可选"
                          />
                        </td>
                        <td className="p-2">
                          <Button type="submit" form={fid} size="sm" className="whitespace-nowrap">
                            保存
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-dashed border-secondary bg-muted/20 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">新增定价</h3>
              <Button type="submit" form="new-tool-price-form" variant="subscription" className="min-w-[7rem] shrink-0">
                添加
              </Button>
            </div>
            <form id="new-tool-price-form" action={createToolBillablePrice} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="new-toolKey">toolKey</Label>
                <Input
                  id="new-toolKey"
                  name="toolKey"
                  required
                  placeholder="fitting-room__ai-fit（AI智能试衣页）或 text-to-image"
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
                  <div className="min-w-[9rem] flex-1 space-y-1.5">
                    <Label htmlFor="new-action" className="text-xs">
                      action（可空=通配）
                    </Label>
                    <Input
                      id="new-action"
                      name="action"
                      placeholder="如 try_on、invoke"
                      className="h-9 font-mono text-xs"
                    />
                  </div>
                  <div className="w-full min-w-[6rem] max-w-[8rem] space-y-1.5">
                    <Label htmlFor="new-price" className="text-xs">
                      单价（元）
                    </Label>
                    <Input
                      id="new-price"
                      name="priceYuan"
                      type="number"
                      step="0.01"
                      min={0}
                      required
                      placeholder="1 或 0.5"
                      className="h-9"
                    />
                  </div>
                  <div className="min-w-[11rem] flex-1 space-y-1.5">
                    <Label htmlFor="new-from" className="text-xs">
                      生效起（北京时间）
                    </Label>
                    <Input id="new-from" name="effectiveFrom" type="datetime-local" required className="h-9 font-mono text-xs" />
                  </div>
                  <div className="min-w-[11rem] flex-1 space-y-1.5">
                    <Label htmlFor="new-to" className="text-xs">
                      生效止（留空=长期）
                    </Label>
                    <Input id="new-to" name="effectiveTo" type="datetime-local" className="h-9 font-mono text-xs" />
                  </div>
                  <div className="flex items-center gap-2 pb-0.5">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked
                      className="h-4 w-4 rounded border-input"
                      id="new-active"
                    />
                    <Label htmlFor="new-active" className="whitespace-nowrap text-sm font-normal leading-none">
                      启用
                    </Label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-note">备注</Label>
                <Input id="new-note" name="note" placeholder="可选" />
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
