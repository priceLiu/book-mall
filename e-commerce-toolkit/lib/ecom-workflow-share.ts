/** 与 book-mall `ecom-workflow-share-duplicate.ts` 的 resourceType 保持一致 */
export const ECOM_WORKFLOW_SHARE_RESOURCE = {
  storyboard: "ecom_storyboard_project",
  modelShot: "ecom_model_shot_project",
  productDesign: "ecom_product_design_project",
  handCraft: "ecom_hand_craft_project",
  seedVideo: "ecom_seed_video_project",
  mediaDecompose: "ecom_media_decompose_project",
  filmPull: "ecom_film_pull_project",
} as const;

export type EcomWorkflowShareResourceType =
  (typeof ECOM_WORKFLOW_SHARE_RESOURCE)[keyof typeof ECOM_WORKFLOW_SHARE_RESOURCE];

export const ECOM_WORKFLOW_SHARE_DESCRIPTION: Record<EcomWorkflowShareResourceType, string> = {
  [ECOM_WORKFLOW_SHARE_RESOURCE.storyboard]:
    "分享 10 位码或主站链接；好友领取副本后可继续编辑分镜并生成成片。",
  [ECOM_WORKFLOW_SHARE_RESOURCE.modelShot]:
    "分享 10 位码或主站链接；好友领取副本后可继续编辑参考图与姿势方案并生成模特图。",
  [ECOM_WORKFLOW_SHARE_RESOURCE.productDesign]:
    "分享 10 位码或主站链接；好友领取副本后可继续编辑主图/详情页方案并生成配图。",
  [ECOM_WORKFLOW_SHARE_RESOURCE.handCraft]:
    "分享 10 位码或主站链接；好友领取副本后可继续编辑线稿与 10 步 IP 全案。",
  [ECOM_WORKFLOW_SHARE_RESOURCE.seedVideo]:
    "分享 10 位码或主站链接；好友领取副本后可继续编辑素材策划与成片流程。",
  [ECOM_WORKFLOW_SHARE_RESOURCE.mediaDecompose]:
    "分享 10 位码或主站链接；好友领取副本后可继续查看拆解结果与一键复刻。",
  [ECOM_WORKFLOW_SHARE_RESOURCE.filmPull]:
    "分享 10 位码或主站链接；好友领取副本后可继续编辑拉片结果与制作脚本。",
};

export function ecomWorkflowShareSessionStorageKey(resourceType: EcomWorkflowShareResourceType): string | null {
  switch (resourceType) {
    case ECOM_WORKFLOW_SHARE_RESOURCE.storyboard:
      return "ecom-storyboard-active-project";
    case ECOM_WORKFLOW_SHARE_RESOURCE.modelShot:
      return "ecom-model-shot-active-project";
    case ECOM_WORKFLOW_SHARE_RESOURCE.handCraft:
      return "ecom-hand-craft-active-project";
    case ECOM_WORKFLOW_SHARE_RESOURCE.seedVideo:
      return "ecom-seed-video-active-project";
    case ECOM_WORKFLOW_SHARE_RESOURCE.mediaDecompose:
      return "ecom-media-decompose-active-project";
    case ECOM_WORKFLOW_SHARE_RESOURCE.filmPull:
      return "ecom-film-pull-active-project";
    case ECOM_WORKFLOW_SHARE_RESOURCE.productDesign:
      return "ecom-product-design-active-project:main-image";
    default:
      return null;
  }
}
