import Link from "next/link";
import { Clapperboard, Film, Layers, Settings } from "lucide-react";

const FEATURES = [
  {
    icon: Clapperboard,
    title: "首页",
    desc: "固定模板对外展示；未来支持多模板与一键发布到 book-mall。",
    href: "/",
  },
  {
    icon: Film,
    title: "创作室",
    desc: "剧本、分镜与生成流程的工作台（一期占位，后续接 AI 引擎）。",
    href: "/studio",
  },
  {
    icon: Layers,
    title: "影像室",
    desc: "素材库与成片管理；与 OSS、主站作品表互通（规划中）。",
    href: "/media",
  },
  {
    icon: Settings,
    title: "模型配置",
    desc: "为空间配置 LLM / 视频 / 图像模型与参数预设。",
    href: "/models",
  },
] as const;

export function StoryFeaturesGrid() {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2">
      {FEATURES.map(({ icon: Icon, title, desc, href }) => (
        <Link
          key={href}
          href={href}
          className="story-card group p-6 transition hover:shadow-md"
        >
          <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-[var(--story-bg)] text-[var(--story-ink)] ring-1 ring-[var(--story-border)]">
            <Icon className="size-5" strokeWidth={1.75} />
          </div>
          <h3 className="text-lg font-semibold group-hover:text-[var(--story-accent)]">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--story-muted)]">{desc}</p>
        </Link>
      ))}
    </div>
  );
}
