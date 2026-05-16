import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { CloudPricingUploadClient } from "./upload-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "云厂商价目导入 / 转换 — 管理后台",
};

export default async function CloudPricingUploadPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <header className="space-y-2">
        <Link
          href="/admin/finance/cloud-pricing"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          返回云厂商价目表
        </Link>
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            云厂商价目 · 导入 / 转换工具
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            支持把多家云厂商导出的 CSV（阿里云 / 腾讯云 / 火山 / 智谱 / Moonshot / 百度 等）
            <strong className="text-foreground">先转成规范列序</strong>，
            预览无误后<strong className="text-foreground">一键导入并设为当前生效版本</strong>。
            未识别表头可在「列别名补丁」里追加。规范列：
            <code className="ml-1 text-foreground">
              region · model_key · tier_raw · billing_kind · input_yuan_per_million · output_yuan_per_million · cost_json
            </code>
          </p>
        </div>
      </header>

      <CloudPricingUploadClient />
    </div>
  );
}
