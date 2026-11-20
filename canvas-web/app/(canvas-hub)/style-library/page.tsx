import { StyleLibraryClient } from "./style-library-client";

export const metadata = {
  title: "风格库 · canvas-web",
  description: "平台内置视觉风格预设，可在画布中套用或生成风格素材节点。",
};

export default function StyleLibraryPage() {
  return <StyleLibraryClient />;
}
