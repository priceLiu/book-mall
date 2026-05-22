/** @type {import('next').NextConfig} */

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
