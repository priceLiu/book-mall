import { PlaceholderWorkspace } from "@/components/placeholder-workspace";

export const metadata = {
  title: "影像室",
};

export default function MediaPage() {
  return (
    <PlaceholderWorkspace
      title="影像室"
      lead="素材上传、版本管理与成片预览将在此实现；与 OSS 及主站作品播放互通在规划中。"
      nextHref="/models"
      nextLabel="模型配置"
    />
  );
}
