import fs from "node:fs";
import path from "node:path";

/** 本地 shared/；Docker 构建用子应用内 docker-shared 快照 */
export function resolveMonorepoShared(appDir, pkg) {
  const monorepo = path.join(appDir, "../shared", pkg);
  if (fs.existsSync(monorepo)) return monorepo;
  return path.join(appDir, "docker-shared", pkg);
}

/**
 * 仅解析 file: 的 @private/platform-assistant 到 monorepo 源码。
 * 勿 alias react / react-dom —— 会破坏 Next 14 SSR（react-dom.preload 等）。
 *
 * @param {import('webpack').Configuration} config
 * @param {string} appDir 子应用绝对路径（含 package.json 的目录）
 */
export function applyWebpackReactSingleton(config, appDir) {
  config.resolve ??= {};
  config.resolve.alias = {
    ...config.resolve.alias,
    "@private/platform-assistant": resolveMonorepoShared(
      appDir,
      "platform-assistant",
    ),
  };
  return config;
}
