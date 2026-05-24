import type { Metadata } from "next";

import { buildAppWebUrl, getCanvasWebOrigin } from "@/lib/app-web-origins";
import { sanitizeAppRedirectPath } from "@/lib/sanitize-app-redirect-path";

import { CanvasOpenClient } from "./canvas-open-client";

export const metadata: Metadata = {
  title: "正在打开 AI 画布…",
  robots: { index: false, follow: false },
};

export default function CanvasOpenPage({
  searchParams,
}: {
  searchParams: { path?: string };
}) {
  const path = sanitizeAppRedirectPath(searchParams.path, "/projects");
  const targetUrl = buildAppWebUrl(getCanvasWebOrigin(), path);
  return <CanvasOpenClient targetUrl={targetUrl} />;
}
