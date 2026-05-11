import type { Metadata } from "next";
import { sanitizeToolsRedirectPath } from "@/lib/sanitize-tools-redirect-path";
import { ToolsOpenClient } from "./tools-open-client";

export const metadata: Metadata = {
  title: "正在打开工具站…",
  robots: { index: false, follow: false },
};

export default function ToolsOpenPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const path = sanitizeToolsRedirectPath(searchParams.redirect);
  const reEnterPath = `/api/sso/tools/re-enter?redirect=${encodeURIComponent(path)}`;

  return <ToolsOpenClient reEnterPath={reEnterPath} />;
}
