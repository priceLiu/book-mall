import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { resolvePublisherReEnterRedirect } from "@/lib/publisher/publisher-open-path";
import { resolveBookAppOpenTargetUrl } from "@/lib/platform-portal-entry";
import { PublisherOpenClient } from "./publisher-open-client";

export const metadata: Metadata = {
  title: "正在打开一键发布…",
  robots: { index: false, follow: false },
};

export default async function PublisherOpenPage({
  searchParams,
}: {
  searchParams: { path?: string; client?: string };
}) {
  const path = resolvePublisherReEnterRedirect(searchParams);
  const session = await getServerSession(authOptions);
  const targetUrl = resolveBookAppOpenTargetUrl({
    app: "publisher",
    path,
    loggedIn: Boolean(session?.user?.id),
  });

  return <PublisherOpenClient reEnterPath={targetUrl} />;
}
