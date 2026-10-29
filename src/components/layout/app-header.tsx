"use client";

import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { Moon, Sun } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { PresenceAvatars } from "@/lib/launcher-kit/presence-avatars";

export function AppHeader({ title }: { title?: string }) {
  const { theme, setTheme } = useTheme();
  const viewAs = useSession().data?.viewAs;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      {title && <h1 className="text-sm font-medium">{title}</h1>}
      <div className="ml-auto flex items-center gap-2">
        {!viewAs && <PresenceAvatars />}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>
    </header>
  );
}
