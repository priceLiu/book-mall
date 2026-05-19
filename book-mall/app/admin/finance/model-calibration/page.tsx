import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listModelCatalogs,
  listPendingAliases,
  calibrationKpi,
} from "@/lib/model-catalog";
import { ModelCalibrationClient } from "./model-calibration-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "模型校准（按厂商）— 管理后台",
};

export default async function ModelCalibrationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  const [kpi, catalogs, pending] = await Promise.all([
    calibrationKpi(),
    listModelCatalogs(),
    listPendingAliases(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">模型校准</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          统一各厂商「商品 Code / 计费项 Code / 规格 / 产品名称」与我们的「toolKey / scheme A 模型名」到一个
          <b>标准模型名（canonicalKey）</b>，作为对账与账单详情的「模型」主键。
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          每次导入云厂商账单（reconciliation）会自动把候选别名 ingest 到此页面，按
          <code>exact / prefix / fuzzy</code> 三级给出建议；HIGH 可一键批准、其他需手动归口。
          支持「单个录入」一次性建立一个标准 + N 条别名。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">标准模型</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpi.catalogs}</div>
            <div className="text-xs text-muted-foreground">canonicalKey 数</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">别名总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpi.aliases}</div>
            <div className="text-xs text-muted-foreground">含已挂载与待审</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">待审别名</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {kpi.pending}
            </div>
            <div className="text-xs text-muted-foreground">catalogId 为空的行</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">HIGH 置信</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {kpi.highConfidence}
            </div>
            <div className="text-xs text-muted-foreground">可批量接受</div>
          </CardContent>
        </Card>
      </div>

      <ModelCalibrationClient catalogs={catalogs} pending={pending} />
    </div>
  );
}
