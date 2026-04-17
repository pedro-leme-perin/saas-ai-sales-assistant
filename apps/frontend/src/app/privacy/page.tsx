'use client';

import Link from 'next/link';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/i18n/use-translation';

const DATA_COLLECTED_ITEMS = [1, 2, 3, 4, 5, 6] as const;
const DATA_SHARING_ITEMS = [1, 2, 3, 4, 5, 6] as const;
const RIGHTS_ITEMS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export default function PrivacyPolicy() {
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
            {t('common.back')}
          </Link>
        </div>
      </nav>

      <article className="pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <header className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              {t('privacy.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('privacy.lastUpdated')}
            </p>
          </header>

          <p className="text-muted-foreground leading-relaxed mb-8">
            {t('privacy.intro')}
          </p>

          <div className="space-y-8">
            {/* Section 1 - Data Controller */}
            <section>
              <h2 className="text-lg font-semibold mb-3">
                {t('privacy.section1Title')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t('privacy.section1Text')}
              </p>
            </section>

            {/* Section 2 - Data Collected (with list) */}
            <section>
              <h2 className="text-lg font-semibold mb-3">
                {t('privacy.section2Title')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {t('privacy.section2Intro')}
              </p>
              <ul className="list-disc pl-6 space-y-2">
                {DATA_COLLECTED_ITEMS.map((i) => (
                  <li
                    key={i}
                    className="text-muted-foreground leading-relaxed"
                  >
                    {t(`privacy.section2Item${i}`)}
                  </li>
                ))}
              </ul>
            </section>

            {/* Sections 3-4 (plain text) */}
            {[3, 4].map((n) => (
              <section key={n}>
                <h2 className="text-lg font-semibold mb-3">
                  {t(`privacy.section${n}Title`)}
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  {t(`privacy.section${n}Text`)}
                </p>
              </section>
            ))}

            {/* Section 5 - Data Sharing (with list) */}
            <section>
              <h2 className="text-lg font-semibold mb-3">
                {t('privacy.section5Title')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {t('privacy.section5Intro')}
              </p>
              <ul className="list-disc pl-6 space-y-2">
                {DATA_SHARING_ITEMS.map((i) => (
                  <li
                    key={i}
                    className="text-muted-foreground leading-relaxed"
                  >
                    {t(`privacy.section5Item${i}`)}
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3 font-medium">
                {t('privacy.section5Footer')}
              </p>
            </section>

            {/* Section 6 - Retention */}
            <section>
              <h2 className="text-lg font-semibold mb-3">
                {t('privacy.section6Title')}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t('privacy.section6Text')}
              </p>
            </section>

            {/* Section 7 - Rights (with list) */}
            <section>
              <h2 className="text-lg font-semibold mb-3">
                {t('privacy.section7Title')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {t('privacy.section7Intro')}
              </p>
              <ul className="list-disc pl-6 space-y-1">
                {RIGHTS_ITEMS.map((i) => (
                  <li
                    key={i}
                    className="text-muted-foreground leading-relaxed"
                  >
                    {t(`privacy.section7Item${i}`)}
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                {t('privacy.section7Footer')}
              </p>
            </section>

            {/* Sections 8-13 (plain text) */}
            {[8, 9, 10, 11, 12, 13].map((n) => (
              <section key={n}>
                <h2 className="text-lg font-semibold mb-3">
                  {t(`privacy.section${n}Title`)}
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  {t(`privacy.section${n}Text`)}
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
              href="/terms"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('landing.termsOfService')}
            </Link>
            <span className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} TheIAdvisor.{' '}
              {t('landing.footerRights')}
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
