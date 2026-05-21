"use client";

import { Icon } from "@/components/ui/icon";
import { Marquee } from "@devnomic/marquee";
import "@devnomic/marquee/dist/index.css";
import { icons } from "lucide-react";

const logoItems = [
  { icon: "Sparkles", name: "AI 工具套件", accent: "text-primary" },
  { icon: "Shirt", name: "AI 试衣", accent: "text-sky-400" },
  { icon: "ImagePlus", name: "文生图", accent: "text-violet-400" },
  { icon: "Headphones", name: "AI 智能客服", accent: "text-emerald-400" },
  { icon: "LayoutDashboard", name: "工具工作台", accent: "text-amber-400" },
  { icon: "History", name: "费用与计费", accent: "text-rose-400" },
  { icon: "BookOpen", name: "实战课程", accent: "text-cyan-400" },
  { icon: "Users", name: "一人公司", accent: "text-orange-400" },
] as const;

function LogoItem({
  icon,
  name,
  accent,
}: {
  icon: (typeof logoItems)[number]["icon"];
  name: string;
  accent: string;
}) {
  return (
    <div className="home-preview-logo-item flex shrink-0 items-center gap-3 whitespace-nowrap">
      <span
        className={`flex size-9 items-center justify-center rounded-lg bg-white/5 ${accent}`}
      >
        <Icon name={icon as keyof typeof icons} size={22} className="shrink-0" />
      </span>
      <span className="text-lg font-medium tracking-tight text-foreground/90 md:text-xl">
        {name}
      </span>
    </div>
  );
}

/** Semi 式全宽 Logo 走马灯（frame14369） */
export function HomePreviewLogoMarquee() {
  return (
    <section id="more-ai-apps" className="home-preview-logos w-full">
      <p className="home-preview-logos-label">已服务 10 万+ 用户</p>
      <div className="home-preview-logos-track">
        <Marquee
          className="home-preview-marquee gap-16 md:gap-24"
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
