import {
  StaticSnapshotsAdminClient,
  snapshotInfoFromRow,
} from "@/components/admin/static-snapshots-admin-client";
import {
  getLatestStaticPageSnapshot,
  listStaticSnapshotGenerationRuns,
  SITE_HOME_PAGE_KEY,
} from "@/lib/static-snapshots/site-home-snapshot-service";

export const metadata = {
  title: "静态资源管理 — 管理后台",
};

export default async function AdminStaticSnapshotsPage() {
  const [latest, runs] = await Promise.all([
    getLatestStaticPageSnapshot(SITE_HOME_PAGE_KEY),
    listStaticSnapshotGenerationRuns(SITE_HOME_PAGE_KEY, 30),
  ]);

  return (
    <StaticSnapshotsAdminClient
      pageKey={SITE_HOME_PAGE_KEY}
      latestSnapshot={latest ? snapshotInfoFromRow(latest) : null}
      initialRuns={runs.map((r) => ({
        ...r,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
      }))}
    />
  );
}
