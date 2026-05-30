import type { Metadata } from "next";

import { sanitizeAppRedirectPath } from "@/lib/sanitize-app-redirect-path";
import { PromptOptimizerOpenClient } from "./prompt-optimizer-open-client";

export const metadata: Metadata = {
  title: "正在打开提示词优化器…",
  robots: { index: false, follow: false },
};

export default function PromptOptimizerOpenPage({
  searchParams,
}: {
  searchParams: { path?: string };
}) {
  const path = sanitizeAppRedirectPath(searchParams.path, "/");
  const reEnterPath = `/api/sso/tools/re-enter?app=prompt-optimizer&redirect=${encodeURIComponent(path)}`;

  return <PromptOptimizerOpenClient reEnterPath={reEnterPath} />;
}
