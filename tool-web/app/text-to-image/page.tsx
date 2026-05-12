import { Hero } from "@/components/ui/hero-with-group-of-images-text-and-two-buttons";
import { getMainSiteOrigin } from "@/lib/site-origin";
import { mainSiteToolsReEnterHref } from "@/lib/main-site-tools-links";
import { TextToImagePanel } from "./text-to-image-panel";

export const metadata = {
  title: "文生图 — AI 工具站",
};

export default function TextToImagePage() {
  const origin = getMainSiteOrigin();
  const renewHref = mainSiteToolsReEnterHref(origin, "/text-to-image");

  return (
    <main className="tw-main fitting-room-main">
      <Hero />

      <section id="text-to-image-panel" aria-labelledby="text-to-image-heading">
        <h1 id="text-to-image-heading" style={{ marginTop: 0 }}>
          文生图
        </h1>

        <TextToImagePanel renewHref={renewHref} mainOrigin={origin} />
      </section>
    </main>
  );
}
