export type Pro2DockUpstreamLink = {
  id: string;
  kind: "outline" | "image" | "text";
  label: string;
  previewUrl?: string;
  previewMd?: string;
  sourceNodeId: string;
};
