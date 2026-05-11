"use client";

import { Icon } from "@/components/ui/icon";
import { Marquee } from "@devnomic/marquee";
import "@devnomic/marquee/dist/index.css";
import { icons } from "lucide-react";
interface sponsorsProps {
  icon: string;
  name: string;
}

const sponsors: sponsorsProps[] = [
  {
    icon: "Crown",
    name: "艾克美品牌",
  },
  {
    icon: "Vegan",
    name: "艾克美标志",
  },
  {
    icon: "Ghost",
    name: "艾克美赞助",
  },
  {
    icon: "Puzzle",
    name: "艾克美文案",
  },
  {
    icon: "Squirrel",
    name: "艾克美",
  },
  {
    icon: "Cookie",
    name: "阿克米",
  },
  {
    icon: "Drama",
    name: "艾克美科技",
  },
];

export const SponsorsSection = () => {
  return (
    <section id="sponsors" className="max-w-[75%] mx-auto pb-24 sm:pb-32">
      <h2 className="text-lg md:text-xl text-center mb-6">
        我们的白金赞助商
      </h2>

      <div className="mx-auto">
        <Marquee
          className="gap-[3rem]"
          fade
          innerClassName="gap-[3rem]"
          pauseOnHover
        >
          {sponsors.map(({ icon, name }) => (
            <div
              key={name}
              className="flex items-center text-xl md:text-2xl font-medium"
            >
              <Icon
                name={icon as keyof typeof icons}
                size={32}
                color="white"
                className="mr-2"
              />
              {name}
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
};
