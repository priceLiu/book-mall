import { PortalCanvasChromeReset } from "@/components/home/portal-canvas-chrome-reset";
import { PortalDiscoverySection } from "@/components/home/portal-discovery-section";
import { PortalFilmCasesSection } from "@/components/home/portal-film-cases-section";
import { PortalHeroSection } from "@/components/home/portal-hero-section";
import { PortalHomeProvider } from "@/components/home/portal-home-context";
import { RecentProjectsSection } from "@/components/home/recent-projects-section";
import { fetchCanvasHomeSnapshotServer } from "@/lib/canvas-home-snapshot.server";
import { emptyCanvasHomeSnapshotPayload } from "@/lib/canvas-home-snapshot-types";

export const revalidate = 86400;

export default async function HomePage() {
  const snapshot = await fetchCanvasHomeSnapshotServer();
  const snapshotMeta = {
    dateKey: snapshot?.dateKey ?? "",
    source: snapshot?.source ?? ("fallback" as const),
    stale: snapshot?.stale ?? true,
  };

  return (
    <PortalHomeProvider
      snapshot={snapshot?.payload ?? emptyCanvasHomeSnapshotPayload()}
      snapshotMeta={snapshotMeta}
    >
      <div className="bg-[var(--canvas-bg)]">
        <PortalCanvasChromeReset />
        <PortalHeroSection />
        <RecentProjectsSection />
        <PortalDiscoverySection />
        <PortalFilmCasesSection />
      </div>
    </PortalHomeProvider>
  );
}
