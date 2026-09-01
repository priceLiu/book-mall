import type { FilmPullAnalyzePatch, FilmPullProject } from "@/lib/film-pull-types";
import { listFilmPullModelRefs, listFilmPullProductRefs } from "@/lib/film-pull-refs";

export type FilmPullV2Phase =
  | "analyze"
  | "replica_idle"
  | "ref_setup"
  | "production_script"
  | "production"
  | "compose";

export function hasFilmPullAnalyze(project: FilmPullProject | null): boolean {
  return Boolean(project?.analyzeResult?.structured);
}

export function isFilmPullReplicaStarted(project: FilmPullProject | null): boolean {
  if (!project) return false;
  return (
    Boolean(project.meta?.replicaResultAt) ||
    listFilmPullModelRefs(project.characterRefs).length > 0 ||
    listFilmPullProductRefs(project.characterRefs).length > 0 ||
    Boolean(project.refMatch?.shots.length) ||
    Boolean(project.productionPlan?.shots.length)
  );
}

export function isFilmPullProductionScriptConfirmed(project: FilmPullProject | null): boolean {
  return Boolean(project?.meta?.productionScriptConfirmedAt?.trim());
}

export function resolveFilmPullV2Phase(project: FilmPullProject | null): FilmPullV2Phase {
  if (!hasFilmPullAnalyze(project)) return "analyze";
  if (!isFilmPullReplicaStarted(project)) return "replica_idle";
  if (!project!.refMatch?.shots.length) return "ref_setup";
  if (!project!.productionPlan?.shots.length) return "production_script";
  const plan = project!.productionPlan!;
  const allVideo = plan.shots.every((s) => s.videoUrl?.trim());
  if (allVideo && plan.render?.finalVideoUrl?.trim()) return "compose";
  return "production";
}

export const FILM_PULL_SCRIPT_PREP_STEP_LABELS = [
  "读取拉片分镜结构",
  "为每镜分配模特/产品参考图",
  "组装画布描述、光影与运镜",
  "生成每镜生图与生视频 Prompt",
  "保存制作脚本表",
] as const;

export function filmPullAnalyzeShots(project: FilmPullProject): FilmPullAnalyzePatch["shots"] {
  return project.analyzeResult?.structured?.shots ?? [];
}

export type FilmPullBottomDockMode =
  | "idle"
  | "ready"
  | "ref-setup"
  | "script"
  | "production";

export function resolveFilmPullBottomDockMode(
  project: FilmPullProject,
  hasAnalyze: boolean,
): FilmPullBottomDockMode {
  const phase = resolveFilmPullV2Phase(project);
  if (!hasAnalyze) return "idle";
  if (phase === "replica_idle") return "ready";
  if (phase === "ref_setup") return "ref-setup";
  if (phase === "production_script") return "script";
  if (phase === "production" || phase === "compose") return "production";
  return "idle";
}

export function filmPullBottomDockHint(mode: FilmPullBottomDockMode): string {
  switch (mode) {
    case "ref-setup":
      return "上传模特/产品后，系统将自动生成制作脚本…";
    case "script":
      return "检查确认脚本表，保存后即可逐镜生图/生视频…";
    case "production":
      return "确认脚本表在上、分镜卡片在下；逐镜生图/生视频后合成成片…";
    case "ready":
      return "点击「一键复刻」开始…";
    default:
      return "完成拉片后可开始复刻…";
  }
}

export function filmPullThreadWelcome(mode: FilmPullBottomDockMode): string {
  switch (mode) {
    case "ref-setup":
      return "参考素材：上传模特与产品图。素材齐后系统在后台生成制作脚本。";
    case "script":
      return "制作工作台：可编辑确认脚本表，保存后直接生图/生视频。";
    case "production":
      return "制作工作台：上方确认脚本，下方分镜图与单镜视频卡片，全部就绪后合成成片。";
    case "ready":
      return "拉片已完成。点击底部「一键复刻」，上传新模特与产品开始制作。";
    default:
      return "上传视频并完成拉片后，可开始一键复刻。";
  }
}
