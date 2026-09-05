import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { sanitizeAppRedirectPath } from "@/lib/sanitize-app-redirect-path";
import { resolveBookAppOpenTargetUrl } from "@/lib/platform-portal-entry";
import { StoryOpenClient } from "./story-open-client";

export const metadata: Metadata = {
  title: "正在打开漫剧剧场…",
  robots: { index: false, follow: false },
};

export default async function StoryOpenPage({
  searchParams,
}: {
  searchParams: { path?: string };
}) {
  const path = sanitizeAppRedirectPath(searchParams.path);
  const session = await getServerSession(authOptions);
  const targetUrl = resolveBookAppOpenTargetUrl({
    app: "story",
    path,
    loggedIn: Boolean(session?.user?.id),
  });

  return <StoryOpenClient reEnterPath={targetUrl} />;
}
