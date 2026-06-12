"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

export type Sbv1DockItem = {
  id: string;
  name: string;
  icon: ReactNode;
  color: string;
  disabled?: boolean;
  onClick?: () => void;
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

  const widthSync = useTransform(distance, [-150, 0, 150], [50, 80, 50]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 150, damping: 12 });

  const heightSync = useTransform(distance, [-150, 0, 150], [50, 80, 50]);
  const height = useSpring(heightSync, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={item.disabled}
      aria-label={item.name}
      style={{ width, height }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsClicked(true)}
      onMouseUp={() => setIsClicked(false)}
      onClick={item.onClick}
      className={cn(
        "relative flex aspect-square cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-40",
      )}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        className={cn(
          "relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl text-white shadow-lg",
          item.color,
        )}
        animate={{
          y: isClicked ? 2 : isHovered ? -8 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 17,
        }}
      >
        <motion.div
          className="[&_svg]:size-5"
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
        className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-800/90 px-2 py-1 text-xs text-white backdrop-blur-sm"
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

export function Sbv1Dock({ items }: { items: Sbv1DockItem[] }) {
  const mouseX = useMotionValue(Infinity);

  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className="pointer-events-auto mx-auto flex h-20 items-end gap-3 rounded-3xl border border-white/[0.08] bg-[rgba(38,38,40,0.72)] px-4 pb-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl backdrop-saturate-150"
      initial={{ y: 48, opacity: 0 }}
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
}
