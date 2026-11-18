import { HomeV2NavAuthSlot } from "@/components/layout/home-v2-nav-auth-slot";
import { SiteHomeV2Content } from "@/components/site-home-v2/site-home-v2-content";
import { loadHomeV2ShowcaseTemplates } from "@/lib/site-home-v2/load-showcase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "智选 AI｜办公・图像・视频・音乐全链路 创作台",
  description: "一人也能拥有一支 AI 部门：办公日常、内容创作、图像创意、视频创作、音乐制作。",
};

export default async function HomeV2Page() {
  const showcaseTemplates = await loadHomeV2ShowcaseTemplates();

  return (
    <SiteHomeV2Content
      authSlot={<HomeV2NavAuthSlot />}
      showcaseTemplates={showcaseTemplates}
    />
  );
}
