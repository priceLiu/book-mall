/** @type {import('next').NextConfig} */

// 允许被 canvas-web（及各子站）以 iframe 嵌入「3D导演台」。
function frameAncestors() {
  const list = new Set(["'self'"]);
  const add = (raw) => {
    const v = raw?.trim().replace(/\/$/, "");
    if (v) list.add(v);
  };
  add(process.env.NEXT_PUBLIC_CANVAS_WEB_ORIGIN);
  add(process.env.CANVAS_WEB_ORIGIN);
  if (process.env.NODE_ENV === "production") {
    add("https://canvas.ai-code8.com");
    add("https://book.ai-code8.com");
  } else {
    add("http://localhost:3000");
    add("http://localhost:3004");
  }
  return Array.from(list).join(" ");
}

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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors()};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
