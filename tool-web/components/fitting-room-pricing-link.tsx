/** 链至主站价格公示 · AI 试衣小节（#ai-tryon） */
export function FittingRoomPricingLink({ mainOrigin }: { mainOrigin: string | null }) {
  const origin = typeof mainOrigin === "string" ? mainOrigin.trim() : "";
  if (!origin) return null;
  return (
    <p className="tw-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
      <a
        href={`${origin}/pricing-disclosure#ai-tryon`}
        target="_blank"
        rel="noopener noreferrer"
      >
        价格说明（AI 试衣）
      </a>
    </p>
  );
}
