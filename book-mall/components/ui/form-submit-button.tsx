"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

type FormSubmitButtonProps = ButtonProps & {
  idleLabel: string;
  pendingLabel: string;
};

/** 须在 <form> 内使用，以读取 useFormStatus().pending（React 18） */
export function FormSubmitButton({
  idleLabel,
  pendingLabel,
  disabled,
  children,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {children ?? (pending ? pendingLabel : idleLabel)}
    </Button>
  );
}
