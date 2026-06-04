import type { Metadata } from "next";
import { sanitizeAppRedirectPath } from "@/lib/sanitize-app-redirect-path";
import { EcomOpenClient } from "./ecom-open-client";

export const metadata: Metadata = {
  title: "正在打开电商工具箱…",
  robots: { index: false, follow: false },
};

export default function EcomOpenPage({
  searchParams,
}: {
  searchParams: { path?: string };
}) {
  const path = sanitizeAppRedirectPath(searchParams.path, "/");
  const reEnterPath = `/api/sso/tools/re-enter?app=e-commerce&redirect=${encodeURIComponent(path)}`;

  return <EcomOpenClient reEnterPath={reEnterPath} />;
}
