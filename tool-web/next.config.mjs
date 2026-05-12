/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static-main.aiyeshi.cn",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "tool-mall.oss-cn-guangzhou.aliyuncs.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
