import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { sanitizeAppRedirectPath } from "@/lib/sanitize-app-redirect-path";
import { resolveBookAppOpenTargetUrl } from "@/lib/platform-portal-entry";
import { EcomOpenClient } from "./ecom-open-client";

export const metadata: Metadata = {
  title: "正在打开电商工具箱…",
  robots: { index: false, follow: false },
};

export default async function EcomOpenPage({
  searchParams,
}: {
  searchParams: { path?: string };
}) {
  const path = sanitizeAppRedirectPath(searchParams.path, "/");
  const session = await getServerSession(authOptions);
  const targetUrl = resolveBookAppOpenTargetUrl({
    app: "e-commerce",
    path,
    loggedIn: Boolean(session?.user?.id),
  });

  return <EcomOpenClient reEnterPath={targetUrl} />;
}
