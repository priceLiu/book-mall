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
    ],
  },
};

export default nextConfig;
