"use client";

import { useLanguage } from "@/components/providers/language-provider";

const OPTIONS = [
  { id: "en" as const, label: "EN" },
  { id: "am" as const, label: "አማ" },
];

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex rounded-full border bg-card p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => setLanguage(option.id)}
          aria-pressed={language === option.id}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
            language === option.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          } ${option.id === "am" ? "amharic" : ""}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
