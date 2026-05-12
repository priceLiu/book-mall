export type AiFitClosetItem = {
  id: string;
  imageUrl: string;
  garmentMode: "two_piece" | "one_piece";
  personImageUrl: string | null;
  topGarmentUrl: string | null;
  bottomGarmentUrl: string | null;
  note: string | null;
  taskId: string | null;
  /** ISO timestamp */
  createdAt: string;
};
