import { getMainSiteOrigin } from "@/lib/site-origin";
import { mainSiteToolsReEnterHref } from "@/lib/main-site-tools-links";
import { SmartSupportHomeClient } from "./smart-support-home-client";

export const metadata = {
  title: "AI智能客服 — AI 工具站",
};

export default function SmartSupportHomePage() {
  const origin = getMainSiteOrigin();
  const renewHref = mainSiteToolsReEnterHref(origin, "/smart-support");

  return (
    <main className="tw-main fitting-room-main">
      <SmartSupportHomeClient renewHref={renewHref} mainOrigin={origin} />
    </main>
  );
}
