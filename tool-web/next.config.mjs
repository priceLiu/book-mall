/** @type {import('next').NextConfig} */
const nextConfig = {
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
