"use client";

import { useLanguage } from "@/components/providers/language-provider";
import type { TranslationKey } from "@/lib/i18n";

type Props = {
  titleKey: TranslationKey;
  leadKey?: TranslationKey;
};

export function PageHeading({ titleKey, leadKey }: Props) {
  const { t, language } = useLanguage();
  const amharic = language === "am";

  return (
    <div className="mb-6">
      <h1 className={`text-2xl font-bold tracking-tight ${amharic ? "amharic" : ""}`}>
        {t(titleKey)}
      </h1>
      {leadKey && (
        <p className={`mt-1 text-sm text-muted-foreground ${amharic ? "amharic" : ""}`}>
          {t(leadKey)}
        </p>
      )}
    </div>
  );
}
