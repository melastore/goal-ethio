"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { readText, writeText } from "@/lib/storage";
import { THEME_KEY, applyTheme, type Theme } from "@/lib/theme";

const OPTIONS: { id: Theme; Icon: typeof Sun; label: string }[] = [
  { id: "light", Icon: Sun, label: "Light" },
  { id: "system", Icon: Monitor, label: "System" },
  { id: "dark", Icon: Moon, label: "Dark" },
];

export function ThemeToggle() {
  // The bootstrap script has already set the class; this only catches up with
  // the stored value so the right option reads as pressed.
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = readText(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") setTheme(stored);
  }, []);

  const choose = (next: Theme) => {
    setTheme(next);
    writeText(THEME_KEY, next);
    applyTheme(next);
  };

  return (
    <div className="flex rounded-full border bg-card p-0.5">
      {OPTIONS.map(({ id, Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => choose(id)}
          aria-label={label}
          aria-pressed={theme === id}
          className={`grid size-7 place-items-center rounded-full transition ${
            theme === id
              ? "bg-muted text-foreground"
              : "text-subtle hover:text-foreground"
          }`}
        >
          <Icon className="size-3.5" strokeWidth={2.2} />
        </button>
      ))}
    </div>
  );
}
