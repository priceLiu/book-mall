export type VideoLibraryMode = "i2v" | "t2v" | "ref";

export type VideoLibraryItem = {
  id: string;
  videoUrl: string;
  prompt: string | null;
  mode: VideoLibraryMode | string;
  resolution: string;
  durationSec: number;
  seed: string | null;
  modelLabel: string | null;
  retainUntil: string;
  createdAt: string;
};

export type VideoLibraryQuota = {
  max: number;
  used: number;
};

export type SaveVideoToLibraryInput = {
  sourceUrl: string;
  mode: VideoLibraryMode;
  prompt?: string | null;
  modelLabel?: string | null;
  resolution?: "720P" | "1080P";
  durationSec?: number;
};
