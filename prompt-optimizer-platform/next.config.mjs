/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return {
      fallback: [
        {
          source:
            "/:path((?!api|auth|sso-error|_next|favicon\\.ico|robots\\.txt).*)",
          destination: "/index.html",
        },
      ],
    };
  },
};

export default nextConfig;
