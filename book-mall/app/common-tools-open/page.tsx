import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { sanitizeAppRedirectPath } from "@/lib/sanitize-app-redirect-path";
import { resolveBookAppOpenTargetUrl } from "@/lib/platform-portal-entry";
import { CommonToolsOpenClient } from "./common-tools-open-client";

export const metadata: Metadata = {
  title: "正在打开常用工具…",
  robots: { index: false, follow: false },
};

export default async function CommonToolsOpenPage({
  searchParams,
}: {
  searchParams: { path?: string };
}) {
  const path = sanitizeAppRedirectPath(searchParams.path, "/");
  const session = await getServerSession(authOptions);
  const targetUrl = resolveBookAppOpenTargetUrl({
    app: "common-tools",
    path,
    loggedIn: Boolean(session?.user?.id),
  });

  return <CommonToolsOpenClient reEnterPath={targetUrl} />;
}
