import { getMainSiteOrigin } from "@/lib/site-origin";
import { mainSiteToolsReEnterHref } from "@/lib/main-site-tools-links";
import { ImageToVideoLabClient } from "./image-to-video-lab-client";

export const metadata = {
  title: "图生视频 · 实验室 — AI 工具站",
};

export default function ImageToVideoLabPage() {
  const origin = getMainSiteOrigin();
  const renewHref = mainSiteToolsReEnterHref(origin, "/image-to-video/lab");

  return (
    <main className="tw-main fitting-room-main image-to-video-lab-main">
      <ImageToVideoLabClient renewHref={renewHref} mainOrigin={origin} />
    </main>
  );
}
