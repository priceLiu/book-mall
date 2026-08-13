/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@private/federated-portal-nav", "@private/platform-assistant"],
};

export default nextConfig;
