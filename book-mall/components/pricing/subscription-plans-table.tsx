"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SubscriptionPlanRow = {
  id: string;
  name: string;
  slug: string;
  intervalLabel: string;
  /** 已格式化的标价，如 ¥12.00 */
  priceDisplay: string;
};

/**
 * 价格公示页「订阅会员价格」小表；行入场动画与 {@link PricingTable} 一致。
 */
export function SubscriptionPlansTable({ rows }: { rows: SubscriptionPlanRow[] }) {
  const reduceMotion = useReducedMotion();
  const rowVariants = useMemo(
    () => ({
      hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 16 },
      visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
          delay: reduceMotion ? 0 : i * 0.05,
          duration: reduceMotion ? 0 : 0.34,
          ease: [0.22, 1, 0.36, 1] as const,
        },
      }),
    }),
    [reduceMotion],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-secondary">
      <Table className="min-w-[560px]">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>套餐</TableHead>
            <TableHead>计费周期</TableHead>
            <TableHead className="text-right">标价</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                暂无在售订阅档位。
              </TableCell>
            </TableRow>
          ) : (
            rows.map((p, rowIndex) => (
              <motion.tr
                key={p.id}
                custom={rowIndex}
                initial="hidden"
                animate="visible"
                variants={rowVariants}
                className={cn(
                  "border-b text-sm transition-colors",
                  "hover:bg-muted/50 data-[state=selected]:bg-muted",
                )}
              >
                <TableCell className="px-3 py-2.5 align-middle">
                  <span className="font-semibold tracking-tight text-foreground">{p.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">({p.slug})</span>
                </TableCell>
                <TableCell className="px-3 py-2.5 align-middle text-muted-foreground">
                  {p.intervalLabel}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-right align-middle font-medium tabular-nums text-foreground">
                  {p.priceDisplay}
                </TableCell>
              </motion.tr>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
