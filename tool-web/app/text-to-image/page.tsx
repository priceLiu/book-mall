import { getMainSiteOrigin } from "@/lib/site-origin";
import { mainSiteToolsReEnterHref } from "@/lib/main-site-tools-links";
import { TextToImageInteractive } from "./text-to-image-interactive";

export const metadata = {
  title: "文生图 — AI 工具站",
};

export default function TextToImagePage() {
  const origin = getMainSiteOrigin();
  const renewHref = mainSiteToolsReEnterHref(origin, "/text-to-image");

  return (
    <main className="tw-main fitting-room-main">
      <TextToImageInteractive renewHref={renewHref} mainOrigin={origin} />
    </main>
  );
}
