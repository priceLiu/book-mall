/** @type {import('next').NextConfig} */

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
