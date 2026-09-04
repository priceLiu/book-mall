import type { OutfitWorkflowPhase } from "@/lib/video-workflow/templates/outfit-v1/ui-config";

export type OutfitBottomDockMode =
  | "idle"
  | "split-ready"
  | "split-busy"
  | "refs-setup"
  | "refs-ready"
  | "generate-ready"
  | "generate-busy"
  | "compose-ready"
  | "compose-busy";

export function resolveOutfitBottomDockMode(opts: {
  phase: OutfitWorkflowPhase;
  splitting?: boolean;
  generateBusy?: boolean;
  renderBusy?: boolean;
  refsReadyToLock?: boolean;
  hasDressedImage?: boolean;
}): { mode: OutfitBottomDockMode; showDock: boolean } {
  if (opts.phase === "done") {
    return { mode: "idle", showDock: false };
  }

  if (opts.splitting) return { mode: "split-busy", showDock: true };
  if (opts.generateBusy) return { mode: "generate-busy", showDock: true };
  if (opts.renderBusy) return { mode: "compose-busy", showDock: true };

  switch (opts.phase) {
    case "upload":
      return { mode: "idle", showDock: true };
    case "split":
      return { mode: "split-ready", showDock: true };
    case "edit_scenes":
    case "bind_refs":
      if (opts.refsReadyToLock) {
        return { mode: "refs-ready", showDock: true };
      }
      return { mode: "refs-setup", showDock: true };
    case "generate_shots":
      return { mode: "generate-ready", showDock: true };
    case "compose":
      return { mode: "compose-ready", showDock: true };
    default:
      return { mode: "idle", showDock: true };
  }
}

export function outfitBottomDockWelcome(mode: OutfitBottomDockMode): string {
  switch (mode) {
    case "split-ready":
      return "参考视频已就绪。点击底部「拆解」，系统将切分镜头并提取预览帧。";
    case "split-busy":
      return "正在拆解分镜，请稍候…";
    case "refs-setup":
      return "分镜已生成。请在上方设置穿搭参考（已穿搭或需穿衣），完成后可锁定并逐镜生成。";
    case "refs-ready":
      return "穿搭参考已齐。点击「锁定特征」后，即可逐镜动作迁移。";
    case "generate-ready":
      return "特征已锁定。点击「逐镜生成视频」，按参考片段批量生成各镜。";
    case "generate-busy":
      return "镜头生成进行中，可在上方表格查看进度。";
    case "compose-ready":
      return "全部镜头已就绪。点击「合成成片」输出竖屏成片。";
    case "compose-busy":
      return "正在合成成片，请稍候…";
    case "idle":
    default:
      return "上传竖屏参考视频并完成拆镜后，可锁定穿搭参考、逐镜生成并合成成片。";
  }
}

export function outfitBottomDockHint(mode: OutfitBottomDockMode): string {
  switch (mode) {
    case "split-ready":
      return "点击「拆解」切分镜头…";
    case "split-busy":
      return "拆解进行中…";
    case "refs-setup":
      return "在上方设置穿搭参考…";
    case "refs-ready":
      return "点击「锁定特征」继续…";
    case "generate-ready":
      return "点击「逐镜生成视频」…";
    case "generate-busy":
      return "镜头生成中…";
    case "compose-ready":
      return "点击「合成成片」…";
    case "compose-busy":
      return "合成进行中…";
    case "idle":
    default:
      return "上传参考视频后可开始拆解…";
  }
}
