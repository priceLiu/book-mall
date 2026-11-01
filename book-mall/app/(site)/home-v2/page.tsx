import { getServerSession } from "next-auth";
import { NavbarAuth } from "@/components/layout/navbar-auth";
import { SiteHomeV2Content } from "@/components/site-home-v2/site-home-v2-content";
import { authOptions } from "@/lib/auth";
import { loadHomeV2ShowcaseTemplates } from "@/lib/site-home-v2/load-showcase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "智选｜办公・图像・视频・音乐全链路 AI 创作台",
  description: "一人也能拥有一支 AI 部门：办公日常、内容创作、图像创意、视频创作、音乐制作。",
};

export default async function HomeV2Page() {
  const [session, showcaseTemplates] = await Promise.all([
    getServerSession(authOptions),
    loadHomeV2ShowcaseTemplates(),
  ]);

  return (
    <SiteHomeV2Content
      isLoggedIn={Boolean(session?.user)}
      authSlot={<NavbarAuth appearance="site-home-v2" />}
      showcaseTemplates={showcaseTemplates}
    />
  );
}
