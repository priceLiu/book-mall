import type { OrderType, PaymentProductKind } from "@prisma/client";

export function orderTypeForProductKind(kind: PaymentProductKind): OrderType {
  switch (kind) {
    case "MEMBERSHIP_PERSONAL":
    case "MEMBERSHIP_TEAM":
      return "MEMBERSHIP";
    case "CREDIT_TOPUP":
      return "CREDIT_TOPUP";
    case "VIP_PACKAGE":
      return "MEMBERSHIP";
    case "BYOK_PERSONAL":
    case "BYOK_TEAM":
      return "BYOK_SERVICE_FEE";
    default:
      return "MEMBERSHIP";
  }
}

export function productKindLabel(kind: PaymentProductKind, snapshot: Record<string, unknown>): string {
  switch (kind) {
    case "MEMBERSHIP_PERSONAL":
      return `个人会员 · ${String(snapshot.planLabel ?? snapshot.tier ?? "")}`;
    case "MEMBERSHIP_TEAM":
      return `团队会员 · ${String(snapshot.planLabel ?? snapshot.tier ?? "")} × ${snapshot.seats ?? ""} 席`;
    case "BYOK_PERSONAL":
      return `BYOK 个人 · ${String(snapshot.label ?? "")}`;
    case "BYOK_TEAM":
      return `BYOK 团队 · ${String(snapshot.label ?? "")}`;
    case "CREDIT_TOPUP":
      return `${String(snapshot.packLabel ?? "轻量包")} · ${snapshot.credits ?? ""} 积分`;
    case "VIP_PACKAGE":
      return `VIP 大额 · ${String(snapshot.planLabel ?? snapshot.scheme ?? "")}`;
    default:
      return kind;
  }
}
