import Link from "next/link";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const book = getMainSiteOrigin();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-semibold">一键发布</h1>
        <p className="text-sm text-[var(--pub-muted)]">
          编辑内容并分发至小红书、抖音、微博、B站、微信公众号。请安装浏览器扩展或桌面端执行发布。
        </p>
      </header>
      <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-base font-medium">快速开始</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--pub-muted)]">
          <li>安装浏览器扩展或下载桌面端（支持多账号矩阵）</li>
          <li>在扩展 / 桌面端完成登录（将跳转本页）</li>
          <li>在各平台网页完成账号登录（扩展借用浏览器登录态）</li>
          <li>在本页或电商工具箱发起发布任务</li>
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/publish"
            className="rounded-xl bg-[var(--pub-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            新建发布
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-black/10 px-4 py-2 text-sm"
          >
            登录
          </Link>
          {book ? (
            <a
              href={`${book}/account/devices`}
              className="rounded-xl border border-black/10 px-4 py-2 text-sm"
              target="_blank"
              rel="noreferrer"
            >
              管理已登录设备
            </a>
          ) : null}
        </div>
      </section>
    </main>
  );
}
