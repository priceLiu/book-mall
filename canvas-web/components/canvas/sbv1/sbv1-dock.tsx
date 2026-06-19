"use client";

import { forwardRef, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { LIBTV_CANVAS_DOCK_BAR_CLASS } from "@/lib/canvas/libtv-node-chrome";

export type Sbv1DockItem = {
  id: string;
  name: string;
  icon: ReactNode;
  color: string;
  disabled?: boolean;
  active?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

function Sbv1DockIcon({
  item,
  mouseX,
}: {
  item: Sbv1DockItem;
  mouseX: MotionValue<number>;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(distance, [-120, 0, 120], [40, 62, 40]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 150, damping: 12 });

  const heightSync = useTransform(distance, [-120, 0, 120], [40, 62, 40]);
  const height = useSpring(heightSync, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  return (
    <motion.button
      ref={ref}
      type="button"
      data-dock-icon=""
      disabled={item.disabled}
      aria-label={item.name}
      style={{ width, height }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsClicked(true)}
      onMouseUp={() => setIsClicked(false)}
      onClick={(e) => item.onClick?.(e)}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "relative flex aspect-square cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-40",
      )}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        className={cn(
          "relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl text-white shadow-md",
          item.color,
        )}
        animate={{
          y: isClicked ? 1 : isHovered ? -5 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 17,
        }}
      >
        <motion.div
          className="[&_svg]:size-4"
          animate={{ scale: isHovered ? 1.1 : 1 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 17,
          }}
        >
          {item.icon}
        </motion.div>

        <motion.div
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent"
          animate={{ opacity: isHovered ? 0.3 : 0.1 }}
          transition={{ duration: 0.2 }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.8 }}
        animate={{
          opacity: isHovered ? 1 : 0,
          y: isHovered ? -20 : 10,
          scale: isHovered ? 1 : 0.8,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
        className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-800/90 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm"
      >
        {item.name}
      </motion.div>

      <motion.div
        className="absolute -bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-white/80"
        animate={{
          scale: isClicked ? 1.5 : 1,
          opacity: isClicked ? 1 : 0.7,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
      />
    </motion.button>
  );
}

export const Sbv1Dock = forwardRef<HTMLDivElement, { items: Sbv1DockItem[] }>(
  function Sbv1Dock({ items }, ref) {
  const mouseX = useMotionValue(Infinity);

  return (
    <motion.div
      ref={ref}
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={LIBTV_CANVAS_DOCK_BAR_CLASS}
      initial={{ y: 32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
        delay: 0.08,
      }}
    >
      {items.map((item) => (
        <Sbv1DockIcon key={item.id} item={item} mouseX={mouseX} />
      ))}
    </motion.div>
  );
});
