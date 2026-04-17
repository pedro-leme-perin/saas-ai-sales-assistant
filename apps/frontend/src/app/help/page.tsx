"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ChevronDown, HelpCircle, Mail } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { useTranslation } from "@/i18n/use-translation";

interface FaqItem {
  questionKey: string;
  answerKey: string;
}

interface FaqCategory {
  titleKey: string;
  items: FaqItem[];
}

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    titleKey: "help.categories.gettingStarted",
    items: [
      { questionKey: "help.faq.whatIs.q", answerKey: "help.faq.whatIs.a" },
      {
        questionKey: "help.faq.howToStart.q",
        answerKey: "help.faq.howToStart.a",
      },
      { questionKey: "help.faq.channels.q", answerKey: "help.faq.channels.a" },
    ],
  },
  {
    titleKey: "help.categories.phoneCalls",
    items: [
      { questionKey: "help.faq.callAI.q", answerKey: "help.faq.callAI.a" },
      {
        questionKey: "help.faq.countries.q",
        answerKey: "help.faq.countries.a",
      },
      {
        questionKey: "help.faq.recording.q",
        answerKey: "help.faq.recording.a",
      },
    ],
  },
  {
    titleKey: "help.categories.whatsapp",
    items: [
      {
        questionKey: "help.faq.whatsappConnect.q",
        answerKey: "help.faq.whatsappConnect.a",
      },
      {
        questionKey: "help.faq.whatsappAI.q",
        answerKey: "help.faq.whatsappAI.a",
      },
      {
        questionKey: "help.faq.messageLimits.q",
        answerKey: "help.faq.messageLimits.a",
      },
    ],
  },
  {
    titleKey: "help.categories.billing",
    items: [
      { questionKey: "help.faq.plans.q", answerKey: "help.faq.plans.a" },
      { questionKey: "help.faq.payment.q", answerKey: "help.faq.payment.a" },
      {
        questionKey: "help.faq.cancellation.q",
        answerKey: "help.faq.cancellation.a",
      },
    ],
  },
  {
    titleKey: "help.categories.privacy",
    items: [
      {
        questionKey: "help.faq.dataProtection.q",
        answerKey: "help.faq.dataProtection.a",
      },
      { questionKey: "help.faq.lgpd.q", answerKey: "help.faq.lgpd.a" },
    ],
  },
  {
    titleKey: "help.categories.support",
    items: [
      { questionKey: "help.faq.getHelp.q", answerKey: "help.faq.getHelp.a" },
      { questionKey: "help.faq.contact.q", answerKey: "help.faq.contact.a" },
    ],
  },
];

function AccordionItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between py-4 text-left text-sm font-medium hover:text-primary transition-colors"
      >
        <span>{question}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="pb-4 text-sm text-muted-foreground leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const { t } = useTranslation();
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">TheIAdvisor</span>
          </Link>
          <div className="flex items-center gap-3">
            <SignedOut>
              <Link
                href="/"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("common.back")}
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("nav.dashboard")}
              </Link>
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-24 sm:pt-32 pb-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-6">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            {t("help.title")}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t("help.subtitle")}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-20 px-4">
        <div className="max-w-3xl mx-auto space-y-10">
          {FAQ_CATEGORIES.map((category) => (
            <div key={category.titleKey}>
              <h2 className="text-lg font-semibold mb-4">
                {t(category.titleKey)}
              </h2>
              <div className="rounded-xl border bg-card p-4">
                {category.items.map((item) => (
                  <AccordionItem
                    key={item.questionKey}
                    question={t(item.questionKey)}
                    answer={t(item.answerKey)}
                    isOpen={openItems.has(item.questionKey)}
                    onToggle={() => toggleItem(item.questionKey)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="py-16 px-4 bg-muted/30 border-t">
        <div className="max-w-2xl mx-auto text-center">
          <Mail className="h-6 w-6 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("help.contactTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t("help.contactDesc")}
          </p>
          <a
            href="mailto:team@theiadvisor.com"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            team@theiadvisor.com
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
              <Sparkles className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">TheIAdvisor</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors"
            >
              {t("help.terms")}
            </Link>
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              {t("help.privacy")}
            </Link>
            <span>
              &copy; {new Date().getFullYear()} TheIAdvisor
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}