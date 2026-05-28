import { VisualLabAnalysisClient } from "./visual-lab-analysis-client";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const metadata = {
  title: "分析室 — 视觉实验室 — AI 工具站",
};

function getGatewayWebOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_GATEWAY_WEB_ORIGIN?.trim() ||
    process.env.GATEWAY_PUBLIC_ORIGIN?.trim() ||
    "http://localhost:3005"
  ).replace(/\/$/, "");
}

export default function VisualLabAnalysisPage() {
  const mainSiteOrigin = getMainSiteOrigin();
  return (
    <main className="tw-main fitting-room-main visual-lab-main visual-lab-main--analysis">
      <VisualLabAnalysisClient
        mainSiteOrigin={mainSiteOrigin}
        gatewayOrigin={getGatewayWebOrigin()}
      />
    </main>
  );
}
