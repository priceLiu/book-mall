import type { Metadata } from "next";

import { sanitizeAppRedirectPath } from "@/lib/sanitize-app-redirect-path";
import { QuickReplicaOpenClient } from "./quick-replica-open-client";

export const metadata: Metadata = {
  title: "正在打开快速复制…",
  robots: { index: false, follow: false },
};

export default function QuickReplicaOpenPage({
  searchParams,
}: {
  searchParams: { path?: string };
}) {
  const path = sanitizeAppRedirectPath(searchParams.path, "/");
  const reEnterPath = `/api/sso/tools/re-enter?app=quick-replica&redirect=${encodeURIComponent(path)}`;

  return <QuickReplicaOpenClient reEnterPath={reEnterPath} />;
}
