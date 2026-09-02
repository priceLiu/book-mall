import {
  attachMediaDecomposeReplicaModelFromLibrary,
  attachMediaDecomposeReplicaRefsFromAssets,
  generateMediaDecomposeReplicaModelImage,
  generateMediaDecomposeReplicaModelPrompt,
  generateMediaDecomposeReplicaScript,
  generateMediaDecomposeReplicaSellingPoints,
  generateMediaDecomposeReplicaVoiceover,
  mockMediaDecomposeReplicaRecognizeProduct,
  recognizeMediaDecomposeReplicaProduct,
  removeMediaDecomposeReplicaRef,
  saveMediaDecomposeReplicaCopyFields,
  uploadMediaDecomposeReplicaRef,
} from "@/lib/ecom-media-decompose-api";
import {
  attachFilmPullModelFromLibrary,
  attachFilmPullRefsFromAssets,
  mockFilmPullRecognizeProduct,
  recognizeFilmPullProduct,
  removeFilmPullRef,
  updateFilmPullProject,
  uploadFilmPullRef,
} from "@/lib/ecom-film-pull-api";
import {
  FILM_PULL_REF_MAX_PER_ROLE,
  isFilmPullModelRefId,
  isFilmPullProductRefId,
  readFilmPullProductBrief,
} from "@/lib/film-pull-refs";
import { isFilmPullMockDevUiEnabled } from "@/lib/film-pull-mock-dev";
import { isMediaDecomposeMockDevUiEnabled } from "@/lib/media-decompose-mock-dev";
import {
  isReplicaModelRefId,
  isReplicaProductRefId,
  REPLICA_REF_MAX_PER_ROLE,
} from "@/lib/media-decompose-replica-refs";
import { readProductBrief, readSellingPoints, readVoiceoverDraft, type ReplicaVoiceoverDraft } from "@/lib/media-decompose-replica-workflow";
import type { FilmPullProject } from "@/lib/film-pull-types";
import type { MediaDecomposeProject } from "@/lib/media-decompose-types";
import type { SeedVideoProject } from "@/lib/seed-video-types";

export type ReplicaSetupRole = "model" | "product";

export type ReplicaSetupRefItem = {
  id: string;
  ossUrl: string;
  label?: string | null;
};

export type ReplicaSetupCopy = {
  panelTitle: string;
  panelDescription: string;
  refSectionLabel: string;
  modelEmptyHint: string;
  productEmptyHint: string;
  scriptGeneratingDetail?: string;
  recognizeStatusDetail?: string;
};

export type ReplicaSetupApi = {
  maxPerRole: number;
  listRefs: () => ReplicaSetupRefItem[];
  isModelRefId: (id: string) => boolean;
  isProductRefId: (id: string) => boolean;
  readProductBrief: () => string;
  readSellingPoints?: () => string;
  readVoiceoverDraft?: () => ReplicaVoiceoverDraft | null;
  uploadRef: (role: ReplicaSetupRole, file: File) => Promise<void>;
  removeRef: (refId: string) => Promise<void>;
  saveProductBrief: (brief: string) => Promise<void>;
  saveCopyFields?: (patch: { productBrief?: string; sellingPoints?: string }) => Promise<void>;
  recognizeProduct: (opts: {
    mock?: boolean;
    userDraft?: string;
  }) => Promise<{ productBrief: string }>;
  generateSellingPoints?: (opts: {
    userDraft?: string;
    productBrief?: string;
  }) => Promise<{ sellingPoints: string }>;
  generateVoiceover?: (opts: {
    productBrief?: string;
    sellingPoints?: string;
    modelKey?: string;
  }) => Promise<void>;
  attachModelFromLibrary?: (entry: { id: string; name: string; ossUrl: string }) => Promise<void>;
  attachRefsFromAssets?: (role: ReplicaSetupRole, assetIds: string[]) => Promise<void>;
  generateScript?: (opts: {
    productBrief: string;
    sellingPoints?: string;
    modelKey: string;
  }) => Promise<void>;
  generateModelPrompt?: (modelKey: string) => Promise<string>;
  generateModelImage?: (opts: {
    prompt: string;
    modelKey: string;
    imageSize?: string;
  }) => Promise<void>;
  mockDevEnabled?: () => boolean;
};

export const MEDIA_DECOMPOSE_REPLICA_SETUP_COPY: ReplicaSetupCopy = {
  panelTitle: "一键复刻 · 素材采集",
  panelDescription:
    "上传新模特与产品参考图，填写卖点后生成复刻脚本。参考图编号按顺序为 @图片1、@图片2…（先模特后产品）。",
  refSectionLabel: "复刻参考图",
  modelEmptyHint: `拖放 / 粘贴 / 我的资产，或 AI 生成模特参考图（可多张，最多 ${REPLICA_REF_MAX_PER_ROLE} 张）。@图片1 起为模特编号。`,
  productEmptyHint: `拖放 / 粘贴 / 我的资产导入产品图（可多张，最多 ${REPLICA_REF_MAX_PER_ROLE} 张）。排在模特图之后的 @图片N 为产品。`,
  scriptGeneratingDetail: "正在根据拆解结果与参考图匹配替换分镜…",
  recognizeStatusDetail: "视觉模型正在分析产品图；若已填写草稿将一并润色补全…",
};

export const FILM_PULL_REF_SETUP_COPY: ReplicaSetupCopy = {
  panelTitle: "参考素材",
  panelDescription:
    "上传模特与产品图，AI 识产品或填写描述。素材齐后系统将自动生成制作脚本。",
  refSectionLabel: "模特 / 产品",
  modelEmptyHint: `拖放 / 粘贴 / 我的资产，或从模特库导入（可多张，最多 ${FILM_PULL_REF_MAX_PER_ROLE} 张）。@图片1 起为模特编号。`,
  productEmptyHint: `拖放 / 粘贴 / 我的资产导入产品图（可多张，最多 ${FILM_PULL_REF_MAX_PER_ROLE} 张）。排在模特图之后的 @图片N 为产品。`,
  recognizeStatusDetail: "视觉模型正在分析产品图；若已填写草稿将一并润色补全…",
};

export function createMediaDecomposeReplicaSetupApi(opts: {
  projectId: string;
  getProject: () => MediaDecomposeProject;
  getSeedVideo: () => SeedVideoProject;
  onProjectUpdated: (project: MediaDecomposeProject) => void;
  onSeedVideoUpdated: (seedVideo: SeedVideoProject) => void;
}): ReplicaSetupApi {
  const { projectId, getProject, getSeedVideo, onProjectUpdated, onSeedVideoUpdated } = opts;

  return {
    maxPerRole: REPLICA_REF_MAX_PER_ROLE,
    listRefs: () =>
      getSeedVideo().references.map((r) => ({
        id: r.id,
        ossUrl: r.ossUrl,
        label: r.label,
      })),
    isModelRefId: isReplicaModelRefId,
    isProductRefId: isReplicaProductRefId,
    readProductBrief: () => readProductBrief(getProject(), getSeedVideo()),
    readSellingPoints: () => readSellingPoints(getProject(), getSeedVideo()),
    readVoiceoverDraft: () => readVoiceoverDraft(getSeedVideo()),
    uploadRef: async (role, file) => {
      const { project, seedVideo } = await uploadMediaDecomposeReplicaRef(projectId, role, file);
      onProjectUpdated(project);
      onSeedVideoUpdated(seedVideo);
    },
    removeRef: async (refId) => {
      const { project, seedVideo } = await removeMediaDecomposeReplicaRef(projectId, refId);
      onProjectUpdated(project);
      onSeedVideoUpdated(seedVideo);
    },
    saveProductBrief: async (brief) => {
      const sellingPoints = readSellingPoints(getProject(), getSeedVideo());
      const { project, seedVideo } = await saveMediaDecomposeReplicaCopyFields(projectId, {
        productBrief: brief,
        sellingPoints,
      });
      onProjectUpdated(project);
      onSeedVideoUpdated(seedVideo);
    },
    saveCopyFields: async (patch) => {
      const { project, seedVideo } = await saveMediaDecomposeReplicaCopyFields(projectId, patch);
      onProjectUpdated(project);
      onSeedVideoUpdated(seedVideo);
    },
    recognizeProduct: async ({ mock, userDraft }) => {
      const result = mock
        ? await mockMediaDecomposeReplicaRecognizeProduct(projectId)
        : await recognizeMediaDecomposeReplicaProduct(projectId, { userDraft });
      onProjectUpdated(result.project);
      onSeedVideoUpdated(result.seedVideo);
      return { productBrief: result.productBrief };
    },
    attachModelFromLibrary: async (entry) => {
      const { project, seedVideo } = await attachMediaDecomposeReplicaModelFromLibrary(
        projectId,
        entry,
      );
      onProjectUpdated(project);
      onSeedVideoUpdated(seedVideo);
    },
    attachRefsFromAssets: async (role, assetIds) => {
      const { project, seedVideo } = await attachMediaDecomposeReplicaRefsFromAssets(
        projectId,
        role,
        assetIds,
      );
      onProjectUpdated(project);
      onSeedVideoUpdated(seedVideo);
    },
    generateSellingPoints: async ({ userDraft, productBrief }) => {
      const result = await generateMediaDecomposeReplicaSellingPoints(projectId, {
        userDraft,
        productBrief,
      });
      onProjectUpdated(result.project);
      onSeedVideoUpdated(result.seedVideo);
      return { sellingPoints: result.sellingPoints };
    },
    generateVoiceover: async ({ productBrief, sellingPoints, modelKey }) => {
      const result = await generateMediaDecomposeReplicaVoiceover(projectId, {
        productBrief,
        sellingPoints,
        modelKey,
      });
      onProjectUpdated(result.project);
      onSeedVideoUpdated(result.seedVideo);
    },
    generateScript: async ({ productBrief, sellingPoints, modelKey }) => {
      const { project, seedVideo } = await generateMediaDecomposeReplicaScript(projectId, {
        productBrief,
        sellingPoints,
        modelKey,
      });
      onProjectUpdated(project);
      onSeedVideoUpdated(seedVideo);
    },
    generateModelPrompt: async (modelKey) => {
      const { prompt } = await generateMediaDecomposeReplicaModelPrompt(projectId, modelKey);
      return prompt;
    },
    generateModelImage: async ({ prompt, modelKey, imageSize }) => {
      const { project, seedVideo } = await generateMediaDecomposeReplicaModelImage(projectId, {
        prompt,
        modelKey,
        imageSize,
      });
      onProjectUpdated(project);
      onSeedVideoUpdated(seedVideo);
    },
    mockDevEnabled: isMediaDecomposeMockDevUiEnabled,
  };
}

export function createFilmPullRefSetupApi(opts: {
  projectId: string;
  getProject: () => FilmPullProject;
  onProjectUpdated: (project: FilmPullProject) => void;
}): ReplicaSetupApi {
  const { projectId, getProject, onProjectUpdated } = opts;

  return {
    maxPerRole: FILM_PULL_REF_MAX_PER_ROLE,
    listRefs: () =>
      getProject().characterRefs.map((r) => ({
        id: r.id,
        ossUrl: r.ossUrl,
        label: r.label,
      })),
    isModelRefId: isFilmPullModelRefId,
    isProductRefId: isFilmPullProductRefId,
    readProductBrief: () => readFilmPullProductBrief(getProject()),
    uploadRef: async (role, file) => {
      onProjectUpdated(await uploadFilmPullRef(projectId, role, file));
    },
    removeRef: async (refId) => {
      onProjectUpdated(await removeFilmPullRef(projectId, refId));
    },
    saveProductBrief: async (brief) => {
      const project = getProject();
      onProjectUpdated(
        await updateFilmPullProject(projectId, {
          meta: { ...(project.meta ?? {}), productBrief: brief },
        }),
      );
    },
    recognizeProduct: async ({ mock, userDraft }) => {
      const result = mock
        ? await mockFilmPullRecognizeProduct(projectId)
        : await recognizeFilmPullProduct(projectId, { userDraft });
      onProjectUpdated(result.project);
      return { productBrief: result.productBrief };
    },
    attachModelFromLibrary: async (entry) => {
      onProjectUpdated(await attachFilmPullModelFromLibrary(projectId, entry));
    },
    attachRefsFromAssets: async (role, assetIds) => {
      onProjectUpdated(await attachFilmPullRefsFromAssets(projectId, role, assetIds));
    },
    mockDevEnabled: isFilmPullMockDevUiEnabled,
  };
}
