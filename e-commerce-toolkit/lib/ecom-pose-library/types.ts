export type EcomPoseLibraryEntry = {
  id: string;
  category: string;
  title: string;
  baseDescription: string;
  tags?: Record<string, unknown>;
  scope?: "platform" | "user";
  userId?: string | null;
  lockedAt?: string | null;
  enabled?: boolean;
  sortOrder?: number;
};

export type EcomPoseLibraryCatalog = {
  poses: EcomPoseLibraryEntry[];
  platform?: EcomPoseLibraryEntry[];
  user?: EcomPoseLibraryEntry[];
};
