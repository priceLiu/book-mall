import { openVtonTryonLibrary } from "@/lib/vton-tryon-library";

/** 打开电商试衣库（非工具站试衣间） */
export function openVtonFittingRoomInNewTab(): void {
  openVtonTryonLibrary({ newTab: true });
}
