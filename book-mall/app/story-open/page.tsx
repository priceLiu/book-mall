import type { Metadata } from "next";

import { sanitizeAppRedirectPath } from "@/lib/sanitize-app-redirect-path";

import { StoryOpenClient } from "./story-open-client";

export const metadata: Metadata = {
  title: "正在打开漫剧剧场…",
  robots: { index: false, follow: false },
};

export default function StoryOpenPage({
  searchParams,
}: {
  searchParams: { path?: string };
}) {
  const path = sanitizeAppRedirectPath(searchParams.path);
  const reEnterPath = `/api/sso/tools/re-enter?app=story&redirect=${encodeURIComponent(path)}`;

  return <StoryOpenClient reEnterPath={reEnterPath} />;
}
