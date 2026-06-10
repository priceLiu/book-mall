-- 团队套餐：下架标准版/进阶版；剩余三档 3 席起订

UPDATE "MembershipPlan"
SET active = false
WHERE family = 'TEAM' AND tier IN ('标准版', '进阶版');

-- 月付
UPDATE "MembershipPlan"
SET
  active = true,
  "sortOrder" = 1,
  "priceYuan" = 567,
  "originalYuan" = 852,
  "includedSeats" = 3,
  "pricePerCreditYuan" = 0.037800
WHERE family = 'TEAM' AND interval = 'MONTH' AND tier = '高级版';

UPDATE "MembershipPlan"
SET
  active = true,
  "sortOrder" = 2,
  "priceYuan" = 747,
  "originalYuan" = 1122,
  "includedSeats" = 3,
  "pricePerCreditYuan" = 0.031125
WHERE family = 'TEAM' AND interval = 'MONTH' AND tier = '豪华版';

UPDATE "MembershipPlan"
SET
  active = true,
  "sortOrder" = 3,
  "priceYuan" = 1287,
  "originalYuan" = 1946,
  "includedSeats" = 3,
  "pricePerCreditYuan" = 0.028600
WHERE family = 'TEAM' AND interval = 'MONTH' AND tier = '至尊版';

-- 年付
UPDATE "MembershipPlan"
SET
  active = true,
  "sortOrder" = 1,
  "priceYuan" = 5670,
  "originalYuan" = 10224,
  "includedSeats" = 3
WHERE family = 'TEAM' AND interval = 'YEAR' AND tier = '高级版';

UPDATE "MembershipPlan"
SET
  active = true,
  "sortOrder" = 2,
  "priceYuan" = 7470,
  "originalYuan" = 13464,
  "includedSeats" = 3
WHERE family = 'TEAM' AND interval = 'YEAR' AND tier = '豪华版';

UPDATE "MembershipPlan"
SET
  active = true,
  "sortOrder" = 3,
  "priceYuan" = 12870,
  "originalYuan" = 23364,
  "includedSeats" = 3
WHERE family = 'TEAM' AND interval = 'YEAR' AND tier = '至尊版';
