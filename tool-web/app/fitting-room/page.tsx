import { getMainSiteOrigin } from "@/lib/site-origin";
import { mainSiteToolsReEnterHref } from "@/lib/main-site-tools-links";
import { FittingRoomPageClient } from "./fitting-room-client";

export const metadata = {
  title: "试衣间 — AI 工具站",
};

export default function FittingRoomPage() {
  const origin = getMainSiteOrigin();
  const renewHref = mainSiteToolsReEnterHref(origin, "/fitting-room");

  return (
    <main className="tw-main fitting-room-main">
      <FittingRoomPageClient renewHref={renewHref} mainOrigin={origin} />
    </main>
  );
}
