/** @type {import('next').NextConfig} */
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
      { protocol: "https", hostname: "*.aliyuncs.com", pathname: "/**" },
      ...ossHostPatterns(),
    ],
  },
};

export default nextConfig;
