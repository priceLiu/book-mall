import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const path = req.nextUrl.pathname;
    if (
      (path === "/admin" || path.startsWith("/admin/")) &&
      req.nextauth.token?.role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/account", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        if (path === "/account") return !!token;
        if (path === "/admin" || path.startsWith("/admin/")) return !!token;
        return true;
      },
    },
  },
);

export const config = {
  matcher: ["/account", "/admin", "/admin/:path*"],
};
