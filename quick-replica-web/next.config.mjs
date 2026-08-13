/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["three", "@sparkjsdev/spark", "@private/federated-portal-nav", "@private/platform-assistant"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
