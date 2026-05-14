import { getMainSiteOrigin } from "@/lib/site-origin";
import { mainSiteToolsReEnterHref } from "@/lib/main-site-tools-links";
import { VisualLabHomeClient } from "./visual-lab-home-client";

export const metadata = {
  title: "视觉实验室 — AI 工具站",
};

export default function VisualLabHomePage() {
  const origin = getMainSiteOrigin();
  const renewHref = mainSiteToolsReEnterHref(origin, "/visual-lab");

  return (
    <main className="tw-main fitting-room-main visual-lab-main">
      <VisualLabHomeClient renewHref={renewHref} mainOrigin={origin} />
    </main>
  );
}
