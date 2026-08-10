/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@private/federated-portal-nav"],
};

export default nextConfig;
