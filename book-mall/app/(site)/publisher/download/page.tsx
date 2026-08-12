import { PublisherDownloadPage } from "@/components/publisher/publisher-download-page";
import { getPublisherDownloadConfig } from "@/lib/publisher/publisher-download-config";

export const metadata = {
  title: "下载一键发布",
  description:
    "下载一键发布浏览器扩展与桌面客户端，多平台内容分发至小红书、抖音、微博、B站、微信公众号。",
};

export default function PublisherDownloadRoutePage() {
  const config = getPublisherDownloadConfig();
  return <PublisherDownloadPage config={config} />;
}
