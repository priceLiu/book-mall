import { PlaceholderWorkspace } from "@/components/placeholder-workspace";

export const metadata = {
  title: "创作室",
};

export default function StudioPage() {
  return (
    <PlaceholderWorkspace
      title="创作室"
      lead="剧本编辑、分镜编排与 AI 生成流水线将在此落地。一期为占位，首页模板与 tool-web 入口已可用。"
      nextHref="/media"
      nextLabel="影像室"
    />
  );
}
