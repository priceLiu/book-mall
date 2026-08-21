import { PortalCanvasChromeReset } from "@/components/home/portal-canvas-chrome-reset";
import { PortalDiscoverySection } from "@/components/home/portal-discovery-section";
import { PortalFilmCasesSection } from "@/components/home/portal-film-cases-section";
import { PortalHeroSection } from "@/components/home/portal-hero-section";
import { PortalHomeProvider } from "@/components/home/portal-home-context";
import { RecentProjectsSection } from "@/components/home/recent-projects-section";

export default function HomePage() {
  return (
    <PortalHomeProvider>
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
