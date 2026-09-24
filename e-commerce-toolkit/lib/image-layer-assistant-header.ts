import type { ImageLayerCanvasToolMode } from "@/lib/image-layer-tool-mode";

export function resolveImageLayerAssistantHeader(
  toolMode: ImageLayerCanvasToolMode,
  hasStack: boolean,
): { title: string; description: string } {
  switch (toolMode) {
    case "bg-replace":
      return {
        title: "背景与主体",
        description:
          "火山 Seedream 5.0 Pro：右侧框选、提示词或图 2 参考，三种玩法可组合",
      };
    case "retouch":
      return {
        title: "局部重绘",
        description: "画布标记选区 → 选模型与参数 → 填写替换描述 → 生成",
      };
    case "erase":
      return {
        title: "图像擦除补全",
        description: "涂抹或框选要去掉的区域 → 开始擦除（自动补全背景，无需选模型）",
      };
    case "decompose-bbox":
      return {
        title: "图片处理",
        description: "框选拆分区域（无需提示词）→ 顶栏「拆层」",
      };
    case "layer-view":
      if (hasStack) {
        return {
          title: "图片处理",
          description: "点击图层编辑卡片 → 填写描述 → 底部一次提交；改完回到整图",
        };
      }
      return {
        title: "图片处理",
        description: "上传图片后可框选拆分，或切换局部重绘 / 擦除",
      };
    default:
      return { title: "图片处理", description: "" };
  }
}
