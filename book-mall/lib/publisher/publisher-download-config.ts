import { existsSync } from "node:fs";
import { join } from "node:path";
import { getPublisherWebOrigin } from "@/lib/app-web-origins";
import { getPublisherExtensionConnectHref } from "@/lib/publisher/publisher-open-path";

export type PublisherDownloadLink = {
  href: string;
  label: string;
  enabled: boolean;
  /** 浏览器直接下载（ZIP 等） */
  download?: boolean;
};

export type PublisherDownloadConfig = {
  productName: string;
  platformCount: number;
  publisherWebOrigin: string | null;
  chromeStore: PublisherDownloadLink;
  edgeStore: PublisherDownloadLink;
  macDmg: PublisherDownloadLink;
  macZip: PublisherDownloadLink;
  winSetup: PublisherDownloadLink;
  githubReleases: PublisherDownloadLink;
  feedback: PublisherDownloadLink;
  extensionDevGuide: PublisherDownloadLink;
  /** 本地构建包是否就绪（public/downloads） */
  hasLocalExtensionZip: boolean;
  hasLocalMacDesktop: boolean;
};

const EXTENSION_ZIP = "publisher-extension-chrome.zip";
const MAC_DESKTOP_ZIP = "publisher-desktop-mac.zip";

function downloadsDir(): string {
  return join(process.cwd(), "public", "downloads");
}

function localArtifactHref(filename: string): string | null {
  const path = join(downloadsDir(), filename);
  return existsSync(path) ? `/downloads/${filename}` : null;
}

function linkFromEnv(
  envKey: string,
  label: string,
  fallback?: string,
): PublisherDownloadLink {
  const raw = process.env[envKey]?.trim() || fallback?.trim() || "";
  return {
    href: raw,
    label,
    enabled: Boolean(raw),
  };
}

function zipLink(href: string | null, label: string): PublisherDownloadLink {
  return {
    href: href ?? "",
    label,
    enabled: Boolean(href),
    download: true,
  };
}

/** 一键发布 · 下载页链接（优先 env，其次 public/downloads 本地构建包） */
export function getPublisherDownloadConfig(): PublisherDownloadConfig {
  const publisherWebOrigin = getPublisherWebOrigin().replace(/\/$/, "") || null;
  const githubDefault =
    process.env.PUBLISHER_GITHUB_RELEASES_URL?.trim() ||
    "https://github.com/leaperone/MultiPost-Extension/releases";

  const extZipHref = localArtifactHref(EXTENSION_ZIP);
  const macZipHref = localArtifactHref(MAC_DESKTOP_ZIP);

  const chromeFromEnv = process.env.PUBLISHER_CHROME_STORE_URL?.trim();
  const edgeFromEnv = process.env.PUBLISHER_EDGE_STORE_URL?.trim();
  const macDmgFromEnv = process.env.PUBLISHER_MAC_DMG_URL?.trim();
  const macZipFromEnv = process.env.PUBLISHER_MAC_ZIP_URL?.trim();

  return {
    productName: "一键发布",
    platformCount: 5,
    publisherWebOrigin,
    chromeStore: chromeFromEnv
      ? linkFromEnv("PUBLISHER_CHROME_STORE_URL", "Chrome 网上应用店")
      : zipLink(extZipHref, "下载 Chrome 扩展（ZIP）"),
    edgeStore: edgeFromEnv
      ? linkFromEnv("PUBLISHER_EDGE_STORE_URL", "Edge 加载项")
      : zipLink(extZipHref, "下载 Edge 扩展（ZIP）"),
    macDmg: macDmgFromEnv
      ? linkFromEnv("PUBLISHER_MAC_DMG_URL", "DMG（Apple Silicon / Intel）")
      : { href: "", label: "DMG（Apple Silicon / Intel）", enabled: false },
    macZip: macZipFromEnv
      ? linkFromEnv("PUBLISHER_MAC_ZIP_URL", "ZIP（Apple Silicon / Intel）")
      : zipLink(macZipHref, "ZIP（Apple Silicon / Intel）"),
    winSetup: linkFromEnv("PUBLISHER_WIN_SETUP_URL", "安装包（Windows 10+ x64）"),
    githubReleases: {
      href: githubDefault,
      label: "GitHub 发布页",
      enabled: Boolean(githubDefault),
    },
    feedback: linkFromEnv(
      "PUBLISHER_FEEDBACK_URL",
      "提交反馈",
      "mailto:support@ai-code8.com?subject=一键发布反馈",
    ),
    extensionDevGuide: {
      href: getPublisherExtensionConnectHref(),
      label: "网页登录并连接扩展",
      enabled: true,
    },
    hasLocalExtensionZip: Boolean(extZipHref),
    hasLocalMacDesktop: Boolean(macZipHref),
  };
}
