import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { sanitizeAppRedirectPath } from "@/lib/sanitize-app-redirect-path";
import { resolveBookAppOpenTargetUrl } from "@/lib/platform-portal-entry";
export const metadata: Metadata = {
  title: "正在打开 AI 画布…",
  robots: { index: false, follow: false },
};

export default async function CanvasOpenPage({
  searchParams,
}: {
  searchParams: { path?: string };
}) {
  const path = sanitizeAppRedirectPath(searchParams.path, "/projects");
  const session = await getServerSession(authOptions);
  const targetUrl = resolveBookAppOpenTargetUrl({
    app: "canvas",
    path,
    loggedIn: Boolean(session?.user?.id),
  });

  /** 服务端 302，避免仅 client replace 时 JS 异常导致一直停在过渡页 */
  redirect(targetUrl);
}
