import { getMainSiteOrigin } from "@/lib/site-origin";
import { mainSiteToolsReEnterHref } from "@/lib/main-site-tools-links";
import { ImageToVideoHomeClient } from "./image-to-video-home-client";

export const metadata = {
  title: "图生视频 — AI 工具站",
};

export default function ImageToVideoHomePage() {
  const origin = getMainSiteOrigin();
  const renewHref = mainSiteToolsReEnterHref(origin, "/image-to-video");

  return (
    <main className="tw-main fitting-room-main">
      <ImageToVideoHomeClient renewHref={renewHref} mainOrigin={origin} />
    </main>
  );
}
