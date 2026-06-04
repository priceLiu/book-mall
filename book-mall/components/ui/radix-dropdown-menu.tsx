"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import { AnimatePresence, motion, type Transition } from "framer-motion";

import { cn } from "@/lib/utils";

const EXIT_DELAY = 0.3;

interface DropdownMenuContextType {
  isOpen: boolean;
  activeValue: string | null;
  setActiveValue: (value: string | null) => void;
  scheduleReset: () => void;
  clearReset: () => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextType>({
  isOpen: false,
  activeValue: null,
  setActiveValue: () => {},
  scheduleReset: () => {},
  clearReset: () => {},
});

const useDropdownMenu = (): DropdownMenuContextType => {
  return React.useContext(DropdownMenuContext);
};

type DropdownMenuProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Root
>;

const DropdownMenu: React.FC<DropdownMenuProps> = ({ children, ...props }) => {
  const [isOpen, setIsOpen] = React.useState(
    props?.open ?? props?.defaultOpen ?? false,
  );
  const [activeValue, setActiveValueState] = React.useState<string | null>(null);
  const exitTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const scheduleReset = React.useCallback(() => {
    if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    exitTimeoutRef.current = setTimeout(() => {
      setActiveValueState(null);
      exitTimeoutRef.current = null;
    }, EXIT_DELAY * 1000);
  }, []);

  const clearReset = React.useCallback(() => {
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    };
  }, []);

  const setActiveValue = (val: string | null) => {
    clearReset();
    setActiveValueState(val);
  };

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      setIsOpen(open);
      props.onOpenChange?.(open);
      if (!open) scheduleReset();
    },
    [props, scheduleReset],
  );

  return (
    <DropdownMenuPrimitive.Root {...props} onOpenChange={handleOpenChange}>
      <DropdownMenuContext.Provider
        value={{
          isOpen,
          activeValue,
          setActiveValue,
          scheduleReset,
          clearReset,
        }}
      >
        {children}
      </DropdownMenuContext.Provider>
    </DropdownMenuPrimitive.Root>
  );
};

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

type DropdownMenuSubTriggerProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.SubTrigger
> & {
  inset?: boolean;
  transition?: Transition;
};

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  DropdownMenuSubTriggerProps
>(
  (
    {
      className,
      children,
      inset,
      disabled,
      transition = { type: "spring", stiffness: 200, damping: 20 },
      ...props
    },
    ref,
  ) => {
    const { activeValue, setActiveValue, scheduleReset, clearReset } =
      useDropdownMenu();
    const id = React.useId();

    return (
      <DropdownMenuPrimitive.SubTrigger
        ref={ref}
        className="relative"
        disabled={disabled}
        onMouseEnter={(e) => {
          clearReset();
          setActiveValue(id);
          props.onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          scheduleReset();
          props.onMouseLeave?.(e);
        }}
        {...props}
      >
        <AnimatePresence>
          {activeValue === id && !disabled ? (
            <motion.span
              className="absolute inset-0 h-full w-full rounded-sm bg-muted"
              layoutId="dropdown-menu-item-background"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition }}
              exit={{
                opacity: 0,
                transition: {
                  ...transition,
                  delay: EXIT_DELAY + (transition?.delay ?? 0),
                },
              }}
            />
          ) : null}
        </AnimatePresence>
        <motion.span
          data-disabled={disabled}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "relative z-[1] flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
            inset && "pl-8",
            className,
          )}
        >
          {children}
          <ChevronRight className="ml-auto" />
        </motion.span>
      </DropdownMenuPrimitive.SubTrigger>
    );
  },
);
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

type DropdownMenuContentProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Content
> & {
  transition?: Transition;
};

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  DropdownMenuContentProps
>(
  (
    {
      className,
      children,
      sideOffset = 4,
      transition = { duration: 0.2 },
      ...props
    },
    ref,
  ) => {
    const { isOpen } = useDropdownMenu();

    return (
      <AnimatePresence>
        {isOpen ? (
          <DropdownMenuPrimitive.Portal forceMount>
            <DropdownMenuPrimitive.Content
              ref={ref}
              sideOffset={sideOffset}
              asChild
              {...props}
            >
              <motion.div
                key="dropdown-menu"
                className={cn(
                  "z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
                  className,
                )}
                initial={{
                  opacity: 0,
                  scale: 0.95,
                  clipPath: "inset(0 0 100% 0)",
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  clipPath: "inset(0 0 0 0)",
                }}
                exit={{
                  opacity: 0,
                  scale: 0.95,
                  clipPath: "inset(0 0 100% 0)",
                }}
                transition={transition}
                style={{ willChange: "opacity, transform, clip-path" }}
              >
                {children}
              </motion.div>
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    );
  },
);
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

type DropdownMenuItemProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Item
> & {
  inset?: boolean;
  transition?: Transition;
};

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  DropdownMenuItemProps
>(
  (
    {
      className,
      children,
      inset,
      disabled,
      asChild,
      transition = { type: "spring", stiffness: 200, damping: 20 },
      ...props
    },
    ref,
  ) => {
    const { activeValue, setActiveValue, scheduleReset, clearReset } =
      useDropdownMenu();
    const id = React.useId();

    const itemClassName = cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className,
    );

    if (asChild) {
      return (
        <DropdownMenuPrimitive.Item
          ref={ref}
          asChild
          disabled={disabled}
          className={itemClassName}
          {...props}
        >
          {children}
        </DropdownMenuPrimitive.Item>
      );
    }

    return (
      <DropdownMenuPrimitive.Item
        ref={ref}
        className="relative"
        disabled={disabled}
        onMouseEnter={(e) => {
          clearReset();
          setActiveValue(id);
          props.onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          scheduleReset();
          props.onMouseLeave?.(e);
        }}
        {...props}
      >
        <AnimatePresence>
          {activeValue === id && !disabled ? (
            <motion.span
              className="absolute inset-0 h-full w-full rounded-sm bg-muted"
              layoutId="dropdown-menu-item-background"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition }}
              exit={{
                opacity: 0,
                transition: {
                  ...transition,
                  delay: EXIT_DELAY + (transition?.delay ?? 0),
                },
              }}
            />
          ) : null}
        </AnimatePresence>
        <motion.span
          data-disabled={disabled}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "relative z-[1] flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
            inset && "pl-8",
            className,
          )}
        >
          {children}
        </motion.span>
      </DropdownMenuPrimitive.Item>
    );
  },
);
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem> & {
    transition?: Transition;
  }
>(
  (
    {
      className,
      children,
      checked,
      disabled,
      transition = { type: "spring", stiffness: 200, damping: 20 },
      ...props
    },
    ref,
  ) => {
    const { activeValue, setActiveValue, scheduleReset, clearReset } =
      useDropdownMenu();
    const id = React.useId();

    return (
      <DropdownMenuPrimitive.CheckboxItem
        ref={ref}
        className="relative"
        checked={checked}
        disabled={disabled}
        onMouseEnter={(e) => {
          clearReset();
          setActiveValue(id);
          props.onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          scheduleReset();
          props.onMouseLeave?.(e);
        }}
        {...props}
      >
        <AnimatePresence>
          {activeValue === id && !disabled ? (
            <motion.span
              className="absolute inset-0 h-full w-full rounded-sm bg-muted"
              layoutId="dropdown-menu-item-background"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition }}
              exit={{
                opacity: 0,
                transition: {
                  ...transition,
                  delay: EXIT_DELAY + (transition?.delay ?? 0),
                },
              }}
            />
          ) : null}
        </AnimatePresence>
        <motion.span
          data-disabled={disabled}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "relative z-[1] flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            className,
          )}
        >
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <DropdownMenuPrimitive.ItemIndicator>
              <Check className="h-4 w-4" />
            </DropdownMenuPrimitive.ItemIndicator>
          </span>
          {children}
        </motion.span>
      </DropdownMenuPrimitive.CheckboxItem>
    );
  },
);
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> & {
    transition?: Transition;
  }
>(
  (
    {
      className,
      children,
      disabled,
      transition = { type: "spring", stiffness: 200, damping: 20 },
      ...props
    },
    ref,
  ) => {
    const { activeValue, setActiveValue, scheduleReset, clearReset } =
      useDropdownMenu();
    const id = React.useId();

    return (
      <DropdownMenuPrimitive.RadioItem
        ref={ref}
        className="relative"
        disabled={disabled}
        onMouseEnter={(e) => {
          clearReset();
          setActiveValue(id);
          props.onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          scheduleReset();
          props.onMouseLeave?.(e);
        }}
        {...props}
      >
        <AnimatePresence>
          {activeValue === id && !disabled ? (
            <motion.span
              className="absolute inset-0 h-full w-full rounded-sm bg-muted"
              layoutId="dropdown-menu-item-background"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition }}
              exit={{
                opacity: 0,
                transition: {
                  ...transition,
                  delay: EXIT_DELAY + (transition?.delay ?? 0),
                },
              }}
            />
          ) : null}
        </AnimatePresence>
        <motion.span
          data-disabled={disabled}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "relative z-[1] flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            className,
          )}
        >
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <DropdownMenuPrimitive.ItemIndicator>
              <Circle className="h-2 w-2 fill-current" />
            </DropdownMenuPrimitive.ItemIndicator>
          </span>
          {children}
        </motion.span>
      </DropdownMenuPrimitive.RadioItem>
    );
  },
);
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
    {...props}
  />
);
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
