import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { sanitizeAppRedirectPath } from "@/lib/sanitize-app-redirect-path";
import { resolveBookAppOpenTargetUrl } from "@/lib/platform-portal-entry";
import { QuickReplicaOpenClient } from "./quick-replica-open-client";

export const metadata: Metadata = {
  title: "正在打开快速复刻…",
  robots: { index: false, follow: false },
};

export default async function QuickReplicaOpenPage({
  searchParams,
}: {
  searchParams: { path?: string };
}) {
  const path = sanitizeAppRedirectPath(searchParams.path, "/");
  const session = await getServerSession(authOptions);
  const targetUrl = resolveBookAppOpenTargetUrl({
    app: "quick-replica",
    path,
    loggedIn: Boolean(session?.user?.id),
  });

  return <QuickReplicaOpenClient reEnterPath={targetUrl} />;
}
