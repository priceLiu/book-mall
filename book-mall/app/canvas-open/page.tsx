import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { sanitizeAppRedirectPath } from "@/lib/sanitize-app-redirect-path";
import { resolveBookAppOpenTargetUrl } from "@/lib/platform-portal-entry";
import { CanvasOpenClient } from "./canvas-open-client";

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

  return <CanvasOpenClient reEnterPath={targetUrl} />;
}
