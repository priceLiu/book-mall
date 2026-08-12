import type { Metadata } from "next";
import { resolvePublisherReEnterRedirect } from "@/lib/publisher/publisher-open-path";
import { PublisherOpenClient } from "./publisher-open-client";

export const metadata: Metadata = {
  title: "正在打开一键发布…",
  robots: { index: false, follow: false },
};

export default function PublisherOpenPage({
  searchParams,
}: {
  searchParams: { path?: string; client?: string };
}) {
  const path = resolvePublisherReEnterRedirect(searchParams);
  const reEnterPath = `/api/sso/tools/re-enter?app=publisher&redirect=${encodeURIComponent(path)}`;

  return <PublisherOpenClient reEnterPath={reEnterPath} />;
}
