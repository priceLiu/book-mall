import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyWebpackReactSingleton } from "../scripts/lib/next-webpack-react-singleton.mjs";

const appDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@private/platform-assistant"],
  webpack: (config) => applyWebpackReactSingleton(config, appDir),
};

export default nextConfig;
