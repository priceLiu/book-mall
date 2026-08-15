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

// 阿里云 OSS 公网域名（虚拟域名 + 自定义 CDN）。
// 本地：可通过 NEXT_PUBLIC_OSS_HOSTS（逗号分隔主机名）追加，例如 "ai-animie.oss-cn-guangzhou.aliyuncs.com,cdn.example.com"。
// 部署：建议在控制台直接写入 NEXT_PUBLIC_OSS_HOSTS。
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
  transpilePackages: ["@private/federated-portal-nav", "@private/platform-assistant"],
  webpack: (config) => {
    config.resolve.alias["@private/federated-portal-nav"] = resolveShared(
      "federated-portal-nav",
    );
    config.resolve.alias["@private/platform-assistant"] = resolveShared(
      "platform-assistant",
    );
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "static-main.aiyeshi.cn", pathname: "/**" },
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
      { protocol: "https", hostname: "fastly.picsum.photos", pathname: "/**" },
      // 通配 .aliyuncs.com 子域（覆盖 <bucket>.oss-<region>.aliyuncs.com，无需为每个 region/bucket 单独配置）
      { protocol: "https", hostname: "*.aliyuncs.com", pathname: "/**" },
      ...ossHostPatterns(),
    ],
  },
};

export default nextConfig;
