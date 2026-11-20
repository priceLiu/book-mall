import { ScriptsClient } from "./scripts-client";

export const metadata = {
  title: "脚本 · canvas-web",
  description: "已发布剧本包列表，可关联新建生产画布。",
};

export default function ScriptsPage() {
  return <ScriptsClient />;
}
