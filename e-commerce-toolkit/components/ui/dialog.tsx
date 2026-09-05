"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // z-[300]：须高于侧栏 z-[200]，否则全屏预览盖不住导航
      "fixed inset-0 z-[300] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/** 全站 Dialog 右上角关闭钮（与图片预览 lightbox 一致） */
export const ECOM_DIALOG_CLOSE_BUTTON_CLASS = cn(
  "absolute right-4 top-4 z-20",
  "flex h-8 w-8 items-center justify-center",
  "rounded-full border-0 bg-black/75 text-white opacity-100 backdrop-blur-sm",
  "shadow-md transition-colors",
  "hover:bg-black hover:opacity-100",
  "focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-0",
  "disabled:pointer-events-none disabled:opacity-40",
);

/** 自定义 overlay / portal 弹层右上角关闭（与故事版 DialogContent 一致） */
export function EcomDialogCloseButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(ECOM_DIALOG_CLOSE_BUTTON_CLASS, className)}
      aria-label="关闭"
      {...props}
    >
      <X className="h-4 w-4 stroke-[2.5]" />
    </button>
  );
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[300] grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-[var(--ecom-hairline)] bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close asChild>
        <EcomDialogCloseButton />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-0 sm:gap-2",
        className,
      )}
      {...props}
    />
  );
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight text-[var(--ecom-ink)]", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm leading-relaxed text-[var(--ecom-muted)]", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

/** 弹出层次要按钮：白底描边黑字 */
export function EcomDialogCancelButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 min-w-[calc(5.5em+1.5rem)] items-center justify-center rounded-md border border-[var(--ecom-hairline)] bg-white px-4 text-sm font-medium text-[var(--ecom-ink)] transition-colors hover:bg-[var(--ecom-parchment)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecom-primary)] focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    />
  );
}

/** 弹出层主按钮：品牌蓝（非胶囊，与参考图一致） */
export function EcomDialogPrimaryButton({
  className,
  destructive,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { destructive?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 min-w-[calc(5.5em+1.5rem)] items-center justify-center rounded-md px-4 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecom-primary)] focus-visible:ring-offset-2",
        destructive
          ? "bg-red-600 hover:bg-red-700"
          : "bg-[var(--ecom-primary)] hover:bg-[var(--ecom-primary-focus)]",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
