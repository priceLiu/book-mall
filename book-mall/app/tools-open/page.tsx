import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { resolveBookAppOpenTargetUrl } from "@/lib/platform-portal-entry";
import { sanitizeToolsRedirectPath } from "@/lib/sanitize-tools-redirect-path";
import { ToolsOpenClient } from "./tools-open-client";

export const metadata: Metadata = {
  title: "正在打开工具站…",
  robots: { index: false, follow: false },
};

export default async function ToolsOpenPage({
  searchParams,
}: {
  searchParams: { redirect?: string; path?: string };
}) {
  const path = sanitizeToolsRedirectPath(
    searchParams.redirect ?? searchParams.path,
  );
  const session = await getServerSession(authOptions);
  const targetUrl = resolveBookAppOpenTargetUrl({
    app: "tool",
    path,
    loggedIn: Boolean(session?.user?.id),
  });

  return <ToolsOpenClient reEnterPath={targetUrl} />;
}
