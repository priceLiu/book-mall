export type EcomProjectListItem = {
  id: string;
  title: string;
  updatedAt: string;
  subtitle?: string | null;
  thumbnailUrl?: string | null;
};

export function formatEcomProjectUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}
