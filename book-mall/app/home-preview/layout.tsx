import "./home-preview.css";
import { HomePreviewShell } from "@/components/layout/home-preview/home-preview-shell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "智选 AI Mall（首页预览）｜找AI上智选",
  description:
    "首页 Semi 风格预览版，内容与正式首页相同，供对比后决定是否替换。",
  robots: { index: false, follow: false },
};

export default function HomePreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HomePreviewShell>{children}</HomePreviewShell>;
}
