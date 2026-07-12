import Link from "next/link";
import { Sparkles, Video, ImageIcon, Smile, Volume2 } from "lucide-react";
import { PortalNav } from "@/components/portal-nav";

const FEATURES = [
  { icon: Video, title: "文生/图生视频", desc: "选好示例，一键复制同款视频效果" },
  { icon: ImageIcon, title: "图像创作", desc: "参考图快速生成同风格图像" },
  { icon: Smile, title: "角色形象", desc: "沉淀你的专属角色，随取随用" },
  { icon: Volume2, title: "配音合成", desc: "多音色配音，视频一步到位" },
];

/** 公开落地页（可被搜索引擎收录）；未登录访问 `/` 时展示。 */
export function QrLanding() {
  return (
    <main className="h-dvh w-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-16">
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6" style={{ color: "var(--qr-brand)" }} />
              <span className="text-xl font-semibold">QuickReplica 快速复制</span>
            </div>
            <div className="flex gap-2">
              <Link href="/login" className="qr-btn-secondary">
                登录
              </Link>
              <Link href="/register" className="qr-btn-primary">
                免费注册
              </Link>
            </div>
          </div>
          <PortalNav current="quick-replica" />
        </header>

        <section className="flex flex-col items-center gap-6 text-center">
          <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            看到喜欢的作品，<span style={{ color: "var(--qr-brand)" }}>一键复制同款</span>
          </h1>
          <p className="max-w-xl text-base text-[var(--qr-text-secondary)]">
            QuickReplica 让你按示例快速生成视频、图像、角色与配音。无需复杂参数，选模板、改内容、即刻出片。
          </p>
          <div className="flex gap-3">
            <Link href="/register" className="qr-btn-primary">
              免费开始
            </Link>
            <Link href="/login" className="qr-btn-secondary">
              已有账号登录
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="qr-card flex flex-col gap-2 p-5">
                <Icon className="h-6 w-6" style={{ color: "var(--qr-brand)" }} />
                <p className="font-semibold">{f.title}</p>
                <p className="text-sm text-[var(--qr-text-secondary)]">{f.desc}</p>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
