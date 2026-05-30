/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  /** 避免客户端路由缓存旧版 RSC（如价格公示改版后仍显示旧样式，需手动刷新） */
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
    /** archiver@8 的 package exports 与 webpack 不兼容，服务端 API 外置加载 */
    serverComponentsExternalPackages: ["archiver"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "cdn1.iconfinder.com",
      },
    ],
  },
};

export default nextConfig;
