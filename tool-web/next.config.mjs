/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@private/platform-assistant"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static-main.aiyeshi.cn",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
