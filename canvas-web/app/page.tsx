import { PortalCanvasChromeReset } from "@/components/home/portal-canvas-chrome-reset";
import { PortalDiscoverySection } from "@/components/home/portal-discovery-section";
import { PortalFilmCasesSection } from "@/components/home/portal-film-cases-section";
import { PortalHeroSection } from "@/components/home/portal-hero-section";
import { PortalHomeProvider } from "@/components/home/portal-home-context";
import { RecentProjectsSection } from "@/components/home/recent-projects-section";
import { fetchCanvasHomeSnapshotServer } from "@/lib/canvas-home-snapshot.server";
import { emptyCanvasHomeSnapshotPayload } from "@/lib/canvas-home-snapshot-types";

export const revalidate = 3600;

export default async function HomePage() {
  const snapshot = await fetchCanvasHomeSnapshotServer();

  return (
    <PortalHomeProvider snapshot={snapshot?.payload ?? emptyCanvasHomeSnapshotPayload()}>
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
