"use client";

import { useLanguage } from "@/components/providers/language-provider";

export function Footer({ generatedAt }: { generatedAt: string }) {
  const { t, language } = useLanguage();

  return (
    <footer className="mt-10 border-t py-6">
      <div className="mx-auto max-w-[1440px] space-y-2 px-4 sm:px-6 lg:px-8 text-xs text-muted-foreground">
        <p className={language === "am" ? "amharic" : undefined}>{t("how.disclaimer")}</p>
        <p className={language === "am" ? "amharic" : undefined}>
          {t("footer.note")} · {t("week.updated")}{" "}
          <time dateTime={generatedAt}>{generatedAt.slice(0, 10)}</time>
        </p>
      </div>
    </footer>
  );
}
