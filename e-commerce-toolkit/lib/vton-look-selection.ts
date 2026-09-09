import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

/** 批量试衣结束后清空搭配编排多选 */
export function shouldClearVtonLookSelectionAfterBatch(status: string | undefined): boolean {
  return status === "done" || status === "cancelled";
}

/** 编排表勾选：仅剔除已删除搭配，不默认全选、不在轮询时补回取消勾选项 */
export function useVtonLookSelectionSync(
  lookDraftIdSig: string,
  setSelectedLookIds: Dispatch<SetStateAction<string[]>>,
) {
  const prevSigRef = useRef(lookDraftIdSig);

  useEffect(() => {
    const prevIds = prevSigRef.current ? prevSigRef.current.split("|").filter(Boolean) : [];
    const nextIds = lookDraftIdSig ? lookDraftIdSig.split("|").filter(Boolean) : [];
    prevSigRef.current = lookDraftIdSig;

    const nextSet = new Set(nextIds);
    setSelectedLookIds((prev) => {
      const kept = prev.filter((id) => nextSet.has(id));
      const prevSet = new Set(prevIds);
      const brandNew = nextIds.filter((id) => !prevSet.has(id));
      // 新加一行搭配时不自动勾选（用户可手动选或点全选）
      if (brandNew.length > 0) return kept;
      return kept;
    });
  }, [lookDraftIdSig, setSelectedLookIds]);
}
