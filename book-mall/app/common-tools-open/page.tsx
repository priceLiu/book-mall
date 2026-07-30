import type { Metadata } from "next";
import { sanitizeAppRedirectPath } from "@/lib/sanitize-app-redirect-path";
import { CommonToolsOpenClient } from "./common-tools-open-client";

export const metadata: Metadata = {
  title: "正在打开常用工具…",
  robots: { index: false, follow: false },
};

export default function CommonToolsOpenPage({
  searchParams,
}: {
  searchParams: { path?: string };
}) {
  const path = sanitizeAppRedirectPath(searchParams.path, "/");
  const reEnterPath = `/api/sso/tools/re-enter?app=common-tools&redirect=${encodeURIComponent(path)}`;

  return <CommonToolsOpenClient reEnterPath={reEnterPath} />;
}
