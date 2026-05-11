import {
  getOpenAiCompatBaseUrl,
  getTextToImageModel,
  isTextToImageBackendConfigured,
} from "@/lib/tool-config";
import { getMainSiteOrigin } from "@/lib/site-origin";
import { mainSiteToolsReEnterHref } from "@/lib/main-site-tools-links";
import { TextToImagePanel } from "./text-to-image-panel";

export const metadata = {
  title: "文生图 — AI 工具站",
};

export default function TextToImagePage() {
  const origin = getMainSiteOrigin();
  const renewHref = mainSiteToolsReEnterHref(origin, "/text-to-image");
  const backendReady = isTextToImageBackendConfigured();
  const basePreview = getOpenAiCompatBaseUrl() ?? "(默认主机 / SDK 默认)";
  const model = getTextToImageModel();

  return (
    <main className="tw-main">
      <h1 style={{ marginTop: 0 }}>文生图</h1>
      <p className="tw-muted">
        本页为工具站内的独立功能模块占位：你可以在 <code>app/api/</code> 下新增 Route Handler，服务端读取{" "}
        <code>lib/tool-config.ts</code>，避免把 Key 暴露给浏览器。
      </p>

      <TextToImagePanel
        renewHref={renewHref}
        mainOrigin={origin}
        backendReady={backendReady}
        basePreview={basePreview}
        model={model}
      />
    </main>
  );
}
