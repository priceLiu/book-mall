import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // 参考深灰控件：填色 #3C3C3C，顶沿高光 #505050（inset），弱外廓与页面区隔
          "flex h-10 w-full rounded-md border border-[#2E2E2E] bg-[#3C3C3C] px-3 py-2 text-sm text-zinc-100 shadow-[inset_0_1px_0_0_#505050] [color-scheme:dark]",
          "placeholder:text-zinc-400",
          "ring-offset-[#3C3C3C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-zinc-100",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
