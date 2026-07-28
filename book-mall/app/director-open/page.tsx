import type { Metadata } from "next";

import { sanitizeAppRedirectPath } from "@/lib/sanitize-app-redirect-path";
import { DirectorOpenClient } from "./director-open-client";

export const metadata: Metadata = {
  title: "正在打开 3D导演台…",
  robots: { index: false, follow: false },
};

export default function DirectorOpenPage({
  searchParams,
}: {
  searchParams: { path?: string };
}) {
  const path = sanitizeAppRedirectPath(searchParams.path, "/");
  const reEnterPath = `/api/sso/tools/re-enter?app=director&redirect=${encodeURIComponent(path)}`;

  return <DirectorOpenClient reEnterPath={reEnterPath} />;
}
