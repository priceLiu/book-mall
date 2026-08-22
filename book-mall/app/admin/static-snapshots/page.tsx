import {
  StaticSnapshotsAdminClient,
  snapshotInfoFromRow,
} from "@/components/admin/static-snapshots-admin-client";
import { CANVAS_HOME_PAGE_KEY } from "@/lib/static-snapshots/canvas-home-payload";
import { SITE_HOME_PAGE_KEY } from "@/lib/static-snapshots/site-home-payload";
import {
  getLatestStaticPageSnapshot,
  listStaticSnapshotGenerationRuns,
} from "@/lib/static-snapshots/site-home-snapshot-service";

export const metadata = {
  title: "静态资源管理 — 管理后台",
};

export default async function AdminStaticSnapshotsPage() {
  const [siteHomeLatest, canvasHomeLatest, siteHomeRuns, canvasHomeRuns] = await Promise.all([
    getLatestStaticPageSnapshot(SITE_HOME_PAGE_KEY),
    getLatestStaticPageSnapshot(CANVAS_HOME_PAGE_KEY),
    listStaticSnapshotGenerationRuns(SITE_HOME_PAGE_KEY, 30),
    listStaticSnapshotGenerationRuns(CANVAS_HOME_PAGE_KEY, 30),
  ]);

  const mapRuns = (runs: typeof siteHomeRuns) =>
    runs.map((r) => ({
      ...r,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    }));

  return (
    <StaticSnapshotsAdminClient
      snapshots={{
        [SITE_HOME_PAGE_KEY]: siteHomeLatest ? snapshotInfoFromRow(siteHomeLatest) : null,
        [CANVAS_HOME_PAGE_KEY]: canvasHomeLatest ? snapshotInfoFromRow(canvasHomeLatest) : null,
      }}
      runsByPageKey={{
        [SITE_HOME_PAGE_KEY]: mapRuns(siteHomeRuns),
        [CANVAS_HOME_PAGE_KEY]: mapRuns(canvasHomeRuns),
      }}
    />
  );
}
