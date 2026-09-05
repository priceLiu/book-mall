import Link from "next/link";
import {
  AlertTriangle,
  Apple,
  Chrome,
  Download,
  ExternalLink,
  Globe,
  MessageSquare,
  Monitor,
} from "lucide-react";
import type { PublisherDownloadConfig, PublisherDownloadLink } from "@/lib/publisher/publisher-download-config";
import { Button } from "@/components/ui/button";

function DownloadButton({
  item,
  icon,
  variant = "outline",
}: {
  item: PublisherDownloadLink;
  icon?: React.ReactNode;
  variant?: "outline" | "default";
}) {
  if (!item.enabled) {
    return (
      <Button type="button" variant="outline" disabled className="h-auto min-h-10 justify-start gap-2 py-2">
        {icon}
        <span className="text-left text-sm">{item.label}</span>
        <span className="ml-auto text-xs text-muted-foreground">即将上线</span>
      </Button>
    );
  }

  const external = item.href.startsWith("http");
  const className =
    variant === "default"
      ? "h-auto min-h-10 w-full justify-start gap-2 py-2.5"
      : "h-auto min-h-10 w-full justify-start gap-2 py-2.5";

  if (external || item.download) {
    return (
      <Button asChild variant={variant} className={className}>
        <a
          href={item.href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          download={item.download ? "" : undefined}
        >
          {icon ?? <Download className="h-4 w-4 shrink-0" />}
          <span className="text-left text-sm">{item.label}</span>
          <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60" />
        </a>
      </Button>
    );
  }

  return (
    <Button asChild variant={variant} className={className}>
      <Link href={item.href}>
        {icon ?? <Download className="h-4 w-4 shrink-0" />}
        <span className="text-left text-sm">{item.label}</span>
      </Link>
    </Button>
  );
}

export function PublisherDownloadPage({ config }: { config: PublisherDownloadConfig }) {
  const { productName, platformCount } = config;

  return (
    <main className="container mx-auto max-w-2xl px-4 pb-20 pt-6 sm:pt-10">
      <nav className="mb-8 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          首页
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">下载 {productName}</span>
      </nav>

      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">下载 {productName}</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          获取 {productName} 客户端，将内容同步发布至小红书、抖音、微博、B 站、微信公众号等{" "}
          {platformCount} 个平台（V1）。
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/publisher-open">打开网页版</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/publisher-open?client=extension&path=/login">连接浏览器扩展</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing">查看会员与定价</Link>
          </Button>
        </div>
      </header>

      <section className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Globe className="h-5 w-5 text-foreground" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">浏览器扩展</h2>
            <p className="text-sm text-muted-foreground">
              安装扩展后，在浏览器内借用各平台登录态完成发布。支持 Chrome 与 Edge。
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DownloadButton
            item={config.chromeStore}
            icon={<Chrome className="h-4 w-4 shrink-0" />}
          />
          <DownloadButton
            item={config.edgeStore}
            icon={
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-xs font-bold">
                E
              </span>
            }
          />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {config.hasLocalExtensionZip ? (
            <>
              下载 ZIP 后解压，打开 Chrome / Edge 的{" "}
              <code className="rounded bg-muted px-1 py-0.5">chrome://extensions</code>{" "}
              或{" "}
              <code className="rounded bg-muted px-1 py-0.5">edge://extensions</code>
              ，开启「开发者模式」，选择「加载已解压的扩展程序」并选中解压目录。安装完成后点击下方按钮完成 Book 账号绑定。
            </>
          ) : (
            <>
              运行{" "}
              <code className="rounded bg-muted px-1 py-0.5">pnpm build:publisher-artifacts</code>{" "}
              生成本地安装包，或通过下方按钮先完成账号绑定（需自行构建{" "}
              <code className="rounded bg-muted px-1 py-0.5">publisher-extension</code>{" "}
              并加载未打包扩展）。
            </>
          )}
        </p>
        <div className="mt-3">
          <DownloadButton item={config.extensionDevGuide} variant="default" />
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Monitor className="h-5 w-5 text-foreground" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">桌面应用</h2>
            <p className="text-sm text-muted-foreground">
              原生桌面客户端，支持<strong className="font-medium text-foreground">多账号矩阵</strong>
              （每个平台账号独立会话分区），适合批量分发与代运营场景。
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Apple className="h-4 w-4" />
            macOS
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <DownloadButton item={config.macDmg} />
            <DownloadButton item={config.macZip} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Monitor className="h-4 w-4" />
            Windows
          </div>
          <DownloadButton item={config.winSetup} />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          {config.hasLocalMacDesktop ? (
            <>
              下载 ZIP 后解压，得到{" "}
              <strong className="font-medium text-foreground">一键发布.app</strong>
              ，双击运行（首次若被 macOS 拦截，请在「系统设置 → 隐私与安全性」中允许）。
            </>
          ) : (
            <>
              运行{" "}
              <code className="rounded bg-muted px-1 py-0.5">pnpm build:publisher-artifacts</code>{" "}
              生成 macOS 桌面包；开发调试也可{" "}
              <code className="rounded bg-muted px-1 py-0.5">pnpm --dir publisher-desktop dev</code>。
            </>
          )}
        </p>
      </section>

      <section className="mb-8 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
          <div className="min-w-0 flex-1 text-sm leading-relaxed text-amber-950 dark:text-amber-100/90">
            <p>
              本软件目前处于公开测试阶段。我们致力于长期更新与改进平台脚本；各平台页面改版可能导致需更新客户端。
            </p>
            <p className="mt-2">
              扩展与桌面端的<strong>平台登录态不互通</strong>：扩展使用浏览器 Cookie，桌面端使用独立分区，请分别在对应客户端登录各平台账号。
            </p>
            {config.feedback.enabled ? (
              <a
                href={config.feedback.href}
                className="mt-3 inline-flex items-center gap-1.5 font-medium text-amber-900 underline-offset-4 hover:underline dark:text-amber-200"
                target={config.feedback.href.startsWith("http") ? "_blank" : undefined}
                rel={config.feedback.href.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                <MessageSquare className="h-4 w-4" />
                提交反馈
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="text-center text-sm text-muted-foreground">
        {config.githubReleases.enabled ? (
          <a
            href={config.githubReleases.href}
            className="inline-flex items-center gap-1.5 hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            在 GitHub 上查看所有发布版本
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span>发布包链接由运维在环境变量中配置。</span>
        )}
      </footer>
    </main>
  );
}
