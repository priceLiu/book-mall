export type AspectRatio = "16:9" | "9:16";

export type ProjectStatus =
  | "DRAFT"
  | "INITIALIZING"
  | "READY"
  | "ARCHIVED";

export type GenerationStatus =
  | "PENDING"
  | "SUBMITTED"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export type ProjectCharacter = {
  id: string;
  name: string;
  role: string;
  description: string;
  /** 仅外观/构图/白底，不含风格段（风格由后端按 styleId 实时拼接） */
  imagePrompt: string;
  avatarUrl: string;
  avatarTaskStatus: GenerationStatus | null;
  avatarTaskFailCode: string | null;
  avatarTaskFailMessage: string | null;
  sortOrder?: number;
};

export type StoryboardFrame = {
  id: string;
  index: number;
  sceneText: string;
  sceneDescription: string;
  characterIds: string[];
  /** 仅角色描述 + 场景描述，不含风格段 */
  imagePrompt: string;
  videoPrompt: string;
  imageUrl: string;
  videoUrl: string;
  imageTaskStatus: GenerationStatus | null;
  videoTaskStatus: GenerationStatus | null;
  imageTaskFailCode: string | null;
  imageTaskFailMessage: string | null;
  videoTaskFailCode: string | null;
  videoTaskFailMessage: string | null;
  /** 当前 imageUrl 对应任务的耗时（ms） */
  imageCostMs: number | null;
  /** 当前 videoUrl 对应任务的耗时（ms） */
  videoCostMs: number | null;
  /** 上次提交视频生成所用的模型 id（用于回填弹窗默认值） */
  videoModelId: string | null;
};

export type PendingTask = {
  id: string;
  kind: string;
  status: GenerationStatus;
  characterId: string | null;
  frameId: string | null;
  failCode: string | null;
  failMessage: string | null;
};

/** 项目「列表态」DTO（不含角色/分镜） */
export type ComicProjectListItem = {
  id: string;
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  styleId: number;
  status: ProjectStatus;
  storyOutline: string;
  coverImageUrl: string;
  /** 风格预设的封面占位（cover 未就绪时使用） */
  styleFallbackUrl: string;
  createdAt: string;
  updatedAt: string;
};

/** 项目「详情态」DTO（含角色/分镜/进行中任务） */
export type ComicProject = ComicProjectListItem & {
  coverTaskStatus: GenerationStatus | null;
  coverTaskFailCode: string | null;
  coverTaskFailMessage: string | null;
  characters: ProjectCharacter[];
  storyboardFrames: StoryboardFrame[];
  pendingTasks: PendingTask[];
};

export type CreateProjectInput = {
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  styleId: number;
};

export type ProjectStep = "story" | "storyboard";
