import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CommunityTemplatesSection } from "@/components/home/community-templates-section";
import { FeaturedWorkflowsSection } from "@/components/home/featured-workflows-section";
import { PortalCanvasChromeReset } from "@/components/home/portal-canvas-chrome-reset";

export default function HomePage() {
  return (
    <div className="bg-[var(--canvas-bg)]">
      <PortalCanvasChromeReset />
      <section className="canvas-hero-fill relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(167,139,250,0.18),transparent)]"
          aria-hidden
        />
        <div className="relative w-full max-w-5xl text-center">
          <p className="twenty-eyebrow">
            canvas-web · AI 节点工作流 · 影视专业版
          </p>
          <h1 className="twenty-headline mx-auto mt-6 max-w-4xl sm:mt-8">
            拖拽节点，把剧本与分镜拼成可协作的制作流。
          </h1>
          <p className="twenty-body mx-auto mt-6 max-w-2xl text-base sm:mt-8 sm:text-lg">
            精选工作流一键创建画布；组级分享与社区模板让你复用他人的节点编排。
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10">
            <Link href="/projects" className="twenty-btn-accent">
              进入我的画布
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </div>
        </div>
      </section>

      <FeaturedWorkflowsSection />
      <CommunityTemplatesSection />
    </div>
  );
}
