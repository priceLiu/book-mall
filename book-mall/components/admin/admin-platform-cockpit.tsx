import Link from "next/link";
import type {
  PlatformCockpitAssistantSection,
  PlatformCockpitCreditOpsSection,
  PlatformCockpitMetricsSection,
  PlatformCockpitSnapshot,
} from "@/lib/admin/platform-cockpit-service";
import { cstBusinessDate } from "@/lib/billing/credit-ops-service";
import { AdminAssistantAiNewsPanel } from "@/components/admin/admin-assistant-ai-news-panel";
import { AdminAssistantModelConfigPanel } from "@/components/admin/admin-assistant-model-config-panel";
import { AdminAssistantFeedbackPanel } from "@/components/admin/admin-assistant-feedback-panel";
import { AdminCreditOpsCockpitPanel } from "@/components/admin/admin-credit-ops-cockpit-panel";
import { AdminPlatformCockpitCharts } from "@/components/admin/admin-platform-cockpit-charts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function fmt(n: number) {
  return n.toLocaleString("zh-CN");
}

function KpiCard({
  label,
  value,
  hint,
  href,
  hrefLabel,
  danger,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  hrefLabel?: string;
  danger?: boolean;
}) {
  return (
    <Card className="flex h-full flex-col border-[#d1d9e0]/80 bg-white/90 shadow-sm backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={`text-2xl tabular-nums tracking-tight sm:text-3xl ${danger ? "text-[#cf1322]" : ""}`}
        >
          {value}
        </CardTitle>
      </CardHeader>
      {(hint || href) && (
        <CardContent className="mt-auto flex flex-1 flex-col pt-0 text-xs text-muted-foreground">
          {hint ? <p className="min-h-[2.5rem] leading-snug">{hint}</p> : null}
          {href ? (
            <Link
              href={href}
              className="mt-auto block pt-2 font-medium text-[#0969da] underline-offset-4 hover:underline"
            >
              {hrefLabel ?? "查看详情 →"}
            </Link>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#1f2328]">{title}</h2>
        {desc ? <p className="mt-0.5 text-sm text-[#656d76]">{desc}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function AdminPlatformCockpitHeader({
  businessDateCst,
  generatedAt,
}: {
  businessDateCst?: string;
  generatedAt?: string;
}) {
  const businessDate = businessDateCst ?? cstBusinessDate(new Date());

  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d1d9e0] pb-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-[#656d76]">
          Book 管理后台
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1f2328] sm:text-3xl">
          平台驾驶舱
        </h1>
        <p className="mt-2 text-sm text-[#656d76]">
          业务日 {businessDate}（CST）
          {generatedAt ? (
            <>
              {" "}
              · 快照 {new Date(generatedAt).toLocaleString("zh-CN")}
            </>
          ) : (
            <span className="text-[#8c959f]"> · 指标加载中…</span>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/finance/credit-expiry-ops"
          className="rounded-md border border-[#0969da] bg-[#0969da] px-3 py-1.5 font-medium text-white hover:bg-[#0550ae]"
        >
          积分清零控制台
        </Link>
        <Link
          href="/admin/errors"
          className="rounded-md border border-[#d1d9e0] bg-white px-3 py-1.5 font-medium text-[#1f2328] hover:border-[#0969da]"
        >
          平台错误
        </Link>
        <Link
          href="/pricing-disclosure"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-[#d1d9e0] bg-white px-3 py-1.5 font-medium text-[#1f2328] hover:border-[#0969da]"
        >
          价格公示
        </Link>
      </div>
    </header>
  );
}

export function AdminPlatformCockpitCreditOps({
  creditOps,
  creditOpsAlerts,
}: PlatformCockpitCreditOpsSection) {
  return <AdminCreditOpsCockpitPanel dashboard={creditOps} alerts={creditOpsAlerts} />;
}

export function AdminPlatformCockpitAssistant({
  assistantFeedback,
  assistantAiNews,
  assistantModelConfig,
}: PlatformCockpitAssistantSection) {
  return (
    <>
      <AdminAssistantModelConfigPanel initial={assistantModelConfig} />
      <AdminAssistantFeedbackPanel
        initialItems={assistantFeedback.items}
        summary={assistantFeedback.summary}
      />
      <AdminAssistantAiNewsPanel rows={assistantAiNews} />
    </>
  );
}

export function AdminPlatformCockpitMetrics({ data }: { data: PlatformCockpitMetricsSection }) {
  return (
    <>
      <AdminPlatformCockpitCharts data={data} />

      <Section title="全站访问">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="今日全站 PV"
            value={fmt(data.traffic.todayPageViews)}
            href="/admin/traffic"
            hrefLabel="访问统计 →"
          />
          <KpiCard
            label="今日全站 UV"
            value={fmt(data.traffic.todayUniqueIps)}
            hint="各应用内 IP 日去重后相加；同一 IP 访问多应用会计多次"
            href="/admin/traffic"
            hrefLabel="按应用查看 →"
          />
        </div>
      </Section>

      <Section title="Gateway 与生成">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="今日 Gateway 成功"
            value={fmt(data.gateway.todaySucceeded)}
            hint="GatewayRequestLog SUCCEEDED"
          />
          <KpiCard
            label="今日 Gateway 失败"
            value={fmt(data.gateway.todayFailed)}
            danger={data.gateway.todayFailed > 0}
          />
          <KpiCard
            label="Gateway 进行中"
            value={fmt(data.gateway.todayRunning)}
            hint="PENDING + RUNNING"
          />
          <KpiCard label="本月 Gateway 成功" value={fmt(data.gateway.monthSucceeded)} />
          <KpiCard
            label="画布生成进行中"
            value={fmt(data.generation.canvasInFlight)}
            hint={`今日失败 ${fmt(data.generation.canvasFailedToday)}`}
          />
        </div>
      </Section>

      <Section title="团队与系统">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="活跃团队" value={fmt(data.teams.activeTenants)} />
          <KpiCard label="活跃成员" value={fmt(data.teams.activeMembers)} />
          <KpiCard
            label="未解决平台错误"
            value={fmt(data.platformHealth.unresolvedErrors)}
            danger={data.platformHealth.unresolvedErrors > 0}
            href="/admin/errors"
          />
          <KpiCard
            label="24h 新增错误"
            value={fmt(data.platformHealth.errorsLast24h)}
            href="/admin/errors"
          />
        </div>
      </Section>
    </>
  );
}

export function AdminPlatformCockpit({ data }: { data: PlatformCockpitSnapshot }) {
  return (
    <div className="space-y-8">
      <AdminPlatformCockpitHeader
        businessDateCst={data.businessDateCst}
        generatedAt={data.generatedAt}
      />

      <AdminPlatformCockpitCreditOps
        creditOps={data.creditOps}
        creditOpsAlerts={data.creditOpsAlerts}
      />

      <AdminPlatformCockpitAssistant
        assistantFeedback={data.assistantFeedback}
        assistantAiNews={data.assistantAiNews}
      />

      <AdminPlatformCockpitMetrics data={data} />
    </div>
  );
}
