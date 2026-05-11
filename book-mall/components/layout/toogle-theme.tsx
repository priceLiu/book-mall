import { useTheme } from "next-themes";
import { Button } from "../ui/button";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type ToggleThemeProps = {
  /** 仅图标，用于顶栏与窄条工具栏，避免 w-full 把整行撑乱 */
  iconOnly?: boolean;
  className?: string;
};

export const ToggleTheme = ({ iconOnly = false, className }: ToggleThemeProps) => {
  const { theme, setTheme } = useTheme();

  if (iconOnly) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("relative h-9 w-9 shrink-0 p-0", className)}
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        aria-label="切换浅色 / 深色模式"
      >
        <Sun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">切换主题</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      size="sm"
      variant="ghost"
      className={cn("w-full justify-start", className)}
    >
      <div className="flex gap-2 dark:hidden">
        <Moon className="size-5" />
        <span className="block lg:hidden">深色模式</span>
      </div>

      <div className="dark:flex gap-2 hidden">
        <Sun className="size-5" />
        <span className="block lg:hidden">浅色模式</span>
      </div>

      <span className="sr-only">切换主题</span>
    </Button>
  );
};
