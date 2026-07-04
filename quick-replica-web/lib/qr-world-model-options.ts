/** Marble-style world model labels (maps 1:1 to World Labs API model ids). */
export type QrWorldModelOption = {
  id: string;
  label: string;
  subtitle?: string;
  badge?: string;
  legacy?: boolean;
  modelKey: string;
};

export const QR_WORLD_MODEL_OPTIONS: QrWorldModelOption[] = [
  {
    id: "marble-1.1-plus",
    label: "Marble 1.1 Plus",
    subtitle: "适合大型场景",
    badge: "New",
    modelKey: "marble-1.1-plus",
  },
  {
    id: "marble-1.1",
    label: "Marble 1.1",
    subtitle: "画质更佳",
    badge: "New",
    modelKey: "marble-1.1",
  },
  {
    id: "marble-1.0",
    label: "Marble 1.0 (legacy)",
    legacy: true,
    modelKey: "marble-1.0",
  },
  {
    id: "marble-1.0-draft",
    label: "Marble 1.0 Draft",
    subtitle: "快速探索创意",
    modelKey: "marble-1.0-draft",
  },
];

export const QR_DEFAULT_WORLD_MODEL_KEY = "marble-1.1";

export function resolveWorldModelOption(modelKey: string): QrWorldModelOption {
  return (
    QR_WORLD_MODEL_OPTIONS.find((o) => o.modelKey === modelKey) ??
    QR_WORLD_MODEL_OPTIONS[1]!
  );
}

export function resolveWorldModelOptionById(id: string): QrWorldModelOption {
  return (
    QR_WORLD_MODEL_OPTIONS.find((o) => o.id === id) ??
    QR_WORLD_MODEL_OPTIONS[1]!
  );
}

/** 多图参考方位（Marble azimuth） */
export const QR_WORLD_REF_VIEWS = [
  { id: "front", label: "Front", azimuth: 0 },
  { id: "right", label: "Right", azimuth: 90 },
  { id: "back", label: "Back", azimuth: 180 },
  { id: "left", label: "Left", azimuth: 270 },
] as const;

export function resolveWorldRefAzimuth(index: number, override?: number): number {
  if (typeof override === "number" && Number.isFinite(override)) return override;
  return QR_WORLD_REF_VIEWS[index % QR_WORLD_REF_VIEWS.length]!.azimuth;
}
