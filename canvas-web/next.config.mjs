/** @type {import('next').NextConfig} */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 本地用仓库根 shared/；CloudBase 镜像里用 docker-shared 快照（见 Dockerfile）。 */
function resolveShared(pkg) {
  const monorepo = path.join(__dirname, "../shared", pkg);
  if (fs.existsSync(monorepo)) return monorepo;
  return path.join(__dirname, "docker-shared", pkg);
}

/** 本地用 book-mall 真源；Docker 仅 COPY 了 compose-ui 到 ../book-mall 时须走 docker-shared（否则 clsx 等无法从 /app/node_modules 解析）。 */
function resolvePlatformComposeUi() {
  const dockerShared = path.join(__dirname, "docker-shared/platform-compose-ui");
  const monorepoRoot = path.join(__dirname, "../book-mall");
  const monorepo = path.join(monorepoRoot, "platform-compose-ui");
  const fullBookMall =
    fs.existsSync(path.join(monorepoRoot, "package.json")) &&
    fs.existsSync(monorepo);
  if (fullBookMall) return monorepo;
  if (fs.existsSync(dockerShared)) return dockerShared;
  if (fs.existsSync(monorepo)) return monorepo;
  return dockerShared;
}

// 阿里云 OSS 公网域名（虚拟域名 + 自定义 CDN）。与 story-web 一致。
function ossHostPatterns() {
  const raw = process.env.NEXT_PUBLIC_OSS_HOSTS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((hostname) => ({ protocol: "https", hostname, pathname: "/**" }));
}

const nextConfig = {
  output: "standalone",
  transpilePackages: [
    "@private/federated-portal-logout",
    "@private/federated-portal-nav",
    "@private/media-render-subtitle-style",
    "@private/platform-assistant",
    "@private/ecom-copy-overlay",
    "@private/platform-compose-ui",
  ],
  webpack: (config) => {
    config.resolve.alias["@private/federated-portal-logout"] = resolveShared(
      "federated-portal-logout",
    );
    config.resolve.alias["@private/federated-portal-nav"] = resolveShared(
      "federated-portal-nav",
    );
    config.resolve.alias["@private/media-render-subtitle-style"] = resolveShared(
      "media-render-subtitle-style",
    );
    config.resolve.alias["@private/platform-assistant"] = resolveShared(
      "platform-assistant",
    );
    config.resolve.alias["@private/ecom-copy-overlay"] = resolveShared("ecom-copy-overlay");
    config.resolve.alias["@private/platform-compose-ui"] = resolvePlatformComposeUi();
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "static-main.aiyeshi.cn", pathname: "/**" },
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
      { protocol: "https", hostname: "fastly.picsum.photos", pathname: "/**" },
      { protocol: "https", hostname: "*.aliyuncs.com", pathname: "/**" },
      {
        protocol: "https",
        hostname: "tool-mall.oss-cn-guangzhou.aliyuncs.com",
        pathname: "/**",
      },
      ...ossHostPatterns(),
    ],
  },
};

export default nextConfig;
