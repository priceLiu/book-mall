import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updateToolNavVisibility } from "@/app/actions/tool-apps-admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "工具菜单 — 管理后台",
};

export default async function AdminToolAppsToolMenuPage() {
  const navRows = await prisma.toolNavVisibility.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">工具菜单</h1>
        <p className="text-sm text-muted-foreground">
          控制工具站左侧导航<strong className="text-foreground">是否展示</strong>各入口（仅影响菜单显隐，不拦截直接访问
          URL）。按次扣费标价请在{" "}
          <Link
            href="/admin/tool-apps/manage"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            工具管理
          </Link>
          中维护。
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
    </div>
  );
}
