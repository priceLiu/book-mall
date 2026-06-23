"use client";

import { Icon } from "@/components/ui/icon";
import { Marquee } from "@devnomic/marquee";
import "@devnomic/marquee/dist/index.css";
import { icons } from "lucide-react";

const logoItems = [
  { icon: "Sparkles", name: "AI 工具套件" },
  { icon: "Shirt", name: "AI 试衣" },
  { icon: "ImagePlus", name: "文生图" },
  { icon: "Headphones", name: "AI 智能客服" },
  { icon: "LayoutDashboard", name: "工具工作台" },
  { icon: "History", name: "费用与计费" },
  { icon: "BookOpen", name: "实战课程" },
  { icon: "Users", name: "一人公司" },
] as const;

function LogoItem({
  icon,
  name,
}: {
  icon: (typeof logoItems)[number]["icon"];
  name: string;
}) {
  return (
    <div className="site-home-logo-item flex shrink-0 items-center gap-3 whitespace-nowrap">
      <span
        className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"
      >
        <Icon
          name={icon as keyof typeof icons}
          size={22}
          color="currentColor"
          className="shrink-0"
        />
      </span>
      <span className="text-lg font-medium tracking-tight text-foreground/90 md:text-xl">
        {name}
      </span>
    </div>
  );
}

/** Semi 式全宽 Logo 走马灯（frame14369） */
export function SiteHomeLogoMarquee() {
  return (
    <section id="more-ai-apps" className="site-home-logos w-full">
      <p className="site-home-logos-label">更多的 AI 应用</p>
      <div className="site-home-logos-track">
        <Marquee
          className="site-home-marquee gap-16 md:gap-24"
          innerClassName="gap-16 md:gap-24"
          fade
          pauseOnHover
        >
          {logoItems.map((item) => (
            <LogoItem key={item.name} {...item} />
          ))}
        </Marquee>
      </div>
    </section>
  );
}
