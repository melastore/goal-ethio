"use client";

import { AlertTriangle } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";

// Shown while src/data/week.json is still the shipped placeholder. Nothing on
// the page means anything until a real pull replaces it.
export function SampleNotice() {
  const { t, language } = useLanguage();
  const amharic = language === "am";

  return (
    <div className="mb-6 flex gap-3 rounded-[16px] border border-draw/40 bg-draw/10 p-4">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-draw" />
      <div className="min-w-0">
        <div className={`text-sm font-bold ${amharic ? "amharic" : ""}`}>{t("sample.title")}</div>
        <p className={`mt-1 text-sm leading-relaxed ${amharic ? "amharic" : ""}`}>
          {t("sample.body")}
        </p>
      </div>
    </div>
  );
}
