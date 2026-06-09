import { describe, expect, it } from "vitest";

import {
  canCreateProposal,
  canFinalApprove,
  canFinanceReview,
  canManagePricing,
  canViewFinanceCost,
  isPlatformStaff,
  roleRank,
} from "@/lib/auth/permissions";

describe("五级角色 RBAC（Phase 6）", () => {
  it("厂商成本/反向验算：仅财务 + 超管 + legacy ADMIN 可见", () => {
    expect(canViewFinanceCost("FINANCE")).toBe(true);
    expect(canViewFinanceCost("SUPER_ADMIN")).toBe(true);
    expect(canViewFinanceCost("ADMIN")).toBe(true);
    expect(canViewFinanceCost("OPERATIONS")).toBe(false);
    expect(canViewFinanceCost("USER")).toBe(false);
    expect(canViewFinanceCost(null)).toBe(false);
  });

  it("管理报价 = 同财务可见集合", () => {
    expect(canManagePricing("FINANCE")).toBe(true);
    expect(canManagePricing("OPERATIONS")).toBe(false);
  });

  it("财务复核：财务 + 超管", () => {
    expect(canFinanceReview("FINANCE")).toBe(true);
    expect(canFinanceReview("SUPER_ADMIN")).toBe(true);
    expect(canFinanceReview("OPERATIONS")).toBe(false);
  });

  it("终审生效：仅超管 + legacy ADMIN", () => {
    expect(canFinalApprove("SUPER_ADMIN")).toBe(true);
    expect(canFinalApprove("ADMIN")).toBe(true);
    expect(canFinalApprove("FINANCE")).toBe(false);
  });

  it("提交调价提案：运营及以上", () => {
    expect(canCreateProposal("OPERATIONS")).toBe(true);
    expect(canCreateProposal("FINANCE")).toBe(true);
    expect(canCreateProposal("USER")).toBe(false);
  });

  it("isPlatformStaff / roleRank 单调递增", () => {
    expect(isPlatformStaff("USER")).toBe(false);
    expect(isPlatformStaff("OPERATIONS")).toBe(true);
    expect(roleRank("USER")).toBeLessThan(roleRank("OPERATIONS"));
    expect(roleRank("OPERATIONS")).toBeLessThan(roleRank("FINANCE"));
    expect(roleRank("FINANCE")).toBeLessThan(roleRank("SUPER_ADMIN"));
  });
});
