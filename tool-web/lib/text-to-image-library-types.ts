export type TextToImageLibraryItem = {
  id: string;
  imageUrl: string;
  prompt: string | null;
  /** ISO timestamp */
  createdAt: string;
};
