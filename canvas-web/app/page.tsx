import { PortalCanvasChromeReset } from "@/components/home/portal-canvas-chrome-reset";
import { PortalDiscoverySection } from "@/components/home/portal-discovery-section";
import { PortalHeroSection } from "@/components/home/portal-hero-section";
import { RecentProjectsSection } from "@/components/home/recent-projects-section";

export default function HomePage() {
  return (
    <div className="bg-[var(--canvas-bg)]">
      <PortalCanvasChromeReset />
      <PortalHeroSection />
      <RecentProjectsSection />
      <PortalDiscoverySection />
    </div>
  );
}
