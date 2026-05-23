import Link from "next/link";
import { ArrowRight, Sparkles, Wand2, Layers, Rocket } from "lucide-react";

export default function HomePage() {
  return (
    <div className="bg-[var(--canvas-bg)]">
      <section className="canvas-container pb-12 pt-16 sm:pb-16 sm:pt-24">
        <p className="twenty-eyebrow text-center">
          canvas-web · AI 海报画布 · 无限节点工作流
        </p>
        <h1 className="twenty-headline mx-auto mt-8 max-w-4xl text-center">
          拖拽节点，让 AI 把灵感拼成海报。
        </h1>
        <p className="twenty-body mx-auto mt-8 max-w-2xl text-center text-base sm:text-lg">
          ComfyUI 风格的可视化画布：导入参考图、写一句产品介绍、连一根线，AI
          就能融合风格与产品，产出一张你想要的设计稿。
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/projects" className="twenty-btn-accent">
            进入我的画布
            <ArrowRight className="ml-2 size-4" />
          </Link>
          <Link href="/gallery" className="twenty-btn-ghost">
            浏览画作
          </Link>
        </div>
      </section>

      <section className="canvas-container pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<Layers className="size-5 text-[var(--canvas-accent)]" />}
            title="可视化节点"
            body="图片 / 文本 / 产品参数 / AI 文本 / 图片生成 / 输出，6 类节点像积木一样自由拼接。"
          />
          <FeatureCard
            icon={<Wand2 className="size-5 text-[var(--canvas-accent)]" />}
            title="多模型一键切换"
            body="nano-banana-pro / gpt-image-1 / kling-image，统一走 KIE，密钥归口 book-mall。"
          />
          <FeatureCard
            icon={<Sparkles className="size-5 text-[var(--canvas-accent)]" />}
            title="多图融合 / 三视图"
            body="一个节点接多张参考图，生成多视角；产品三视图、风格融合一次到位。"
          />
          <FeatureCard
            icon={<Rocket className="size-5 text-[var(--canvas-accent)]" />}
            title="并行不卡顿"
            body="单画布 5 节点并行，30 秒级出图，前端排队 + 后端限流双保险。"
          />
          <FeatureCard
            icon={<Layers className="size-5 text-[var(--canvas-accent)]" />}
            title="模板复用"
            body="电商海报 / 短视封面 / 三视图 3 套内置模板；保存自有模板，一键复用。"
          />
          <FeatureCard
            icon={<Wand2 className="size-5 text-[var(--canvas-accent)]" />}
            title="外部拖图"
            body="从桌面或浏览器外把图片直接拖进画布，秒变图片节点。"
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-5 transition hover:border-[var(--canvas-accent)]/40">
      <div className="flex size-9 items-center justify-center rounded-lg bg-white/5">
        {icon}
      </div>
      <h3 className="mt-4 text-sm font-medium text-white">{title}</h3>
      <p className="mt-2 text-xs leading-6 text-[var(--canvas-muted)]">{body}</p>
    </div>
  );
}
