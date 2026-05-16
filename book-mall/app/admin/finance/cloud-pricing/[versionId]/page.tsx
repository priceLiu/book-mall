import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { VersionDetailClient, type DetailRow } from "./version-detail-client";

export const dynamic = "force-dynamic";

type Props = {
  params: { versionId: string };
};

export default async function CloudPricingVersionPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/admin");
  }
  const { versionId } = params;
  const version = await prisma.pricingSourceVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      kind: true,
      sourceSha256: true,
      label: true,
      importedAt: true,
      isCurrent: true,
      rowCount: true,
      parseWarnings: true,
    },
  });
  if (!version) {
    notFound();
  }

  const lines = await prisma.pricingSourceLine.findMany({
    where: { versionId },
    orderBy: [{ sectionH2: "asc" }, { modelKey: "asc" }, { tierRaw: "asc" }],
    select: {
      id: true,
      sectionH2: true,
      sectionH3: true,
      modelKey: true,
      tierRaw: true,
      billingKind: true,
      inputYuanPerMillion: true,
      outputYuanPerMillion: true,
      costJson: true,
    },
  });
  const detailRows: DetailRow[] = lines.map((l) => ({
    id: l.id,
    sectionH2: l.sectionH2,
    sectionH3: l.sectionH3,
    modelKey: l.modelKey,
    tierRaw: l.tierRaw,
    billingKind: l.billingKind,
    inputYuanPerMillion: l.inputYuanPerMillion,
    outputYuanPerMillion: l.outputYuanPerMillion,
    costJson: l.costJson,
  }));

  const warnings = (version.parseWarnings as unknown[]) ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <header className="space-y-2">
        <Link
          href="/admin/finance/cloud-pricing"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          返回价目版本列表
        </Link>
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            价目版本 · 详情
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <Meta label="ID">
              <code className="text-foreground">{version.id.slice(0, 12)}…</code>
            </Meta>
            <Meta label="厂商/源">
              <Badge variant="outline" className="font-mono text-[10px]">
                {version.kind}
              </Badge>
            </Meta>
            <Meta label="标签">{version.label ?? <span className="text-muted-foreground">—</span>}</Meta>
            <Meta label="行数">
              <span className="tabular-nums text-foreground">{version.rowCount}</span>
            </Meta>
            <Meta label="导入时间">
              <span className="tabular-nums text-foreground">
                {version.importedAt.toISOString().replace("T", " ").slice(0, 19)}
              </span>
            </Meta>
            <Meta label="状态">
              {version.isCurrent ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400 border-emerald-500/30">
                  生效中
                </Badge>
              ) : (
                <span className="text-muted-foreground">历史</span>
              )}
            </Meta>
            <Meta label="SHA-256">
              <code className="text-foreground">{version.sourceSha256.slice(0, 16)}…</code>
            </Meta>
          </div>
        </div>
      </header>

      {warnings.length > 0 ? (
        <section className="flex gap-3 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">解析告警 ({warnings.length})</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
              {warnings.slice(0, 10).map((w, i) => (
                <li key={i}>{typeof w === "string" ? w : JSON.stringify(w)}</li>
              ))}
              {warnings.length > 10 ? (
                <li className="opacity-80">… 还有 {warnings.length - 10} 条</li>
              ) : null}
            </ul>
          </div>
        </section>
      ) : null}

      <VersionDetailClient rows={detailRows} />
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-muted-foreground">{label}：</span>
      {children}
    </span>
  );
}
