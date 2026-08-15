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
    "@private/federated-portal-nav",
    "@private/publisher-client",
    "@private/platform-assistant",
  ],
  webpack: (config) => {
    config.resolve.alias["@private/publisher-client"] = resolveShared(
      "publisher-client",
    );
    config.resolve.alias["@private/platform-assistant"] = resolveShared(
      "platform-assistant",
    );
    config.resolve.alias["@private/federated-portal-nav"] = resolveShared(
      "federated-portal-nav",
    );
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.aliyuncs.com", pathname: "/**" },
      ...ossHostPatterns(),
    ],
  },
};

export default nextConfig;
