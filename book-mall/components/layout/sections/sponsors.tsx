"use client";

import { Icon } from "@/components/ui/icon";
import { Marquee } from "@devnomic/marquee";
import "@devnomic/marquee/dist/index.css";
import { icons } from "lucide-react";

interface AiAppMarqueeItem {
  icon: string;
  name: string;
}

/** 与工具站侧栏 / 套件分组对齐的应用名称（轮换展示） */
const aiApps: AiAppMarqueeItem[] = [
  { icon: "Shirt", name: "AI 试衣" },
  { icon: "ImagePlus", name: "文生图" },
  { icon: "Headphones", name: "AI智能客服" },
  { icon: "History", name: "费用与计费说明" },
  { icon: "Sparkles", name: "AI 工具套件" },
  { icon: "LayoutDashboard", name: "工具工作台" },
];

export const SponsorsSection = () => {
  return (
    <section id="more-ai-apps" className="max-w-[75%] mx-auto pb-24 sm:pb-32">
      <h2 className="text-lg md:text-xl text-center mb-2">更多的 AI 应用</h2>
      <p className="text-sm text-muted-foreground text-center mb-8 max-w-xl mx-auto">
        下列为当前工具站内已接入的分组名称；开通会员订阅并按规则充值钱包后，可在独立工具站中使用。
      </p>

      <div className="mx-auto">
        <Marquee className="gap-[3rem]" fade innerClassName="gap-[3rem]" pauseOnHover>
          {aiApps.map(({ icon, name }) => (
            <div
              key={name}
              className="flex items-center text-xl md:text-2xl font-medium whitespace-nowrap"
            >
              <Icon
                name={icon as keyof typeof icons}
                size={32}
                color="white"
                className="mr-2 shrink-0"
              />
              {name}
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
};
