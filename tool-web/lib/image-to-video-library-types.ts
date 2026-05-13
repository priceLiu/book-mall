export type ImageToVideoLibraryItem = {
  id: string;
  videoUrl: string;
  prompt: string | null;
  mode: string;
  resolution: string;
  durationSec: number;
  seed: string | null;
  modelLabel: string | null;
  retainUntil: string;
  createdAt: string;
};

export type ToolLibraryQuota = {
  max: number;
  used: number;
};
