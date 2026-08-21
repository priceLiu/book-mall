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

const nextConfig = {
  output: "standalone",
  transpilePackages: [
    "@private/federated-portal-logout",
    "@private/federated-portal-nav",
    "@private/platform-assistant",
  ],
  webpack: (config) => {
    config.resolve.alias["@private/federated-portal-logout"] = resolveShared(
      "federated-portal-logout",
    );
    config.resolve.alias["@private/federated-portal-nav"] = resolveShared(
      "federated-portal-nav",
    );
    config.resolve.alias["@private/platform-assistant"] = resolveShared(
      "platform-assistant",
    );
    return config;
  },
};

export default nextConfig;
