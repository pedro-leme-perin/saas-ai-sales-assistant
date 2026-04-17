"use client";

import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";

const SECTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function TermsOfService() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">TheIAdvisor</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
        </div>
      </nav>

      <article className="pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <header className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              {t("terms.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("terms.lastUpdated")}
            </p>
          </header>

          <p className="text-muted-foreground leading-relaxed mb-8">
            {t("terms.intro")}
          </p>

          <div className="space-y-8">
            {SECTIONS.map((n) => (
              <section key={n}>
                <h2 className="text-lg font-semibold mb-3">
                  {t(`terms.section${n}Title`)}
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  {t(`terms.section${n}Text`)}
                </p>
              </section>
            ))}
          </div>
        </div>
      </article>

      <footer className="border-t py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
              <Sparkles className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">TheIAdvisor</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("landing.privacyPolicy")}
            </Link>
            <span className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} TheIAdvisor.{" "}
              {t("landing.footerRights")}
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
