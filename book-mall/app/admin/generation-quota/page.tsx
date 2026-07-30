import { AdminGenerationQuotaClient } from "@/components/admin/admin-generation-quota-client";
import {
  SUBMIT_BURST_ELEVATED,
  SUBMIT_BURST_HEAVY_DEFAULT,
  SUBMIT_BURST_STANDARD,
  SUBMIT_WINDOW_SEC,
} from "@/lib/generation/submit-rate/constants";

export const metadata = {
  title: "生成频率配额 — 管理后台",
};

export default function AdminGenerationQuotaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">生成频率配额</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          配置经 Gateway 的<strong className="text-foreground">新生成请求</strong>在{" "}
          <strong className="text-foreground">{SUBMIT_WINDOW_SEC} 秒</strong>窗口内的 burst 上限。
          个人项目按个人空间（<code className="text-xs">user:</code>）计数；团队项目按团队空间（
          <code className="text-xs">tenant:</code>）计数。未 stamp 的 scope 热路径按最差{" "}
          <strong className="text-foreground">{SUBMIT_BURST_STANDARD} 次</strong>处理。
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            普通：<span className="tabular-nums text-foreground">{SUBMIT_BURST_STANDARD}</span> 次 /{" "}
            {SUBMIT_WINDOW_SEC}s
          </li>
          <li>
            中度：<span className="tabular-nums text-foreground">{SUBMIT_BURST_ELEVATED}</span> 次 /{" "}
            {SUBMIT_WINDOW_SEC}s（平台 ADMIN / SUPER_ADMIN 未单独配置时默认）
          </li>
          <li>
            重度：可配 burst，未填默认{" "}
            <span className="tabular-nums text-foreground">{SUBMIT_BURST_HEAVY_DEFAULT}</span> 次 /{" "}
            {SUBMIT_WINDOW_SEC}s
          </li>
        </ul>
      </div>
      <AdminGenerationQuotaClient />
    </div>
  );
}
