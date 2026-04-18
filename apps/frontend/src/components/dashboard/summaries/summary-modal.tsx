"use client";

// =============================================
// 📄 SummaryModal
// =============================================
// Session 44 — shows the on-demand conversation summary (key points,
// sentiment timeline, next best action). Consumed by call / whatsapp
// detail screens via an "AI summary" button.
// =============================================

import { useEffect } from "react";
import { X, Sparkles, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import type { ConversationSummary, SentimentPoint } from "@/services/summaries.service";

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: ConversationSummary | null;
  loading: boolean;
  error: string | null;
  title: string;
}

const SENTIMENT_DOT: Record<SentimentPoint, string> = {
  positive: "bg-emerald-500",
  neutral: "bg-slate-400",
  negative: "bg-red-500",
};

export function SummaryModal({
  isOpen,
  onClose,
  summary,
  loading,
  error,
  title,
}: SummaryModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("summaries.modal.ariaLabel")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-center justify-between border-b bg-background/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="px-6 py-5 space-y-6">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t("summaries.modal.loading")}
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          {summary && !loading && (
            <>
              <section>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("summaries.modal.keyPoints")}
                </h3>
                <ul className="space-y-2">
                  {summary.keyPoints.map((point, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" aria-hidden />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("summaries.modal.sentimentTimeline")}
                </h3>
                <div className="relative h-6">
                  <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border" aria-hidden />
                  {summary.sentimentTimeline.map((tick, i) => (
                    <div
                      key={i}
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${Math.max(0, Math.min(1, tick.position)) * 100}%` }}
                      title={tick.note ?? tick.sentiment}
                    >
                      <span
                        className={`block h-3 w-3 rounded-full ring-2 ring-background ${SENTIMENT_DOT[tick.sentiment]}`}
                        aria-label={tick.sentiment}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{t("summaries.modal.start")}</span>
                  <span>{t("summaries.modal.end")}</span>
                </div>
              </section>

              <section className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <ArrowRight className="h-4 w-4 text-primary" aria-hidden />
                  {t("summaries.modal.nextBestAction")}
                </div>
                <p className="text-sm">{summary.nextBestAction}</p>
              </section>

              <footer className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span>
                  {summary.cached
                    ? t("summaries.modal.cached")
                    : t("summaries.modal.fresh")}
                </span>
                <span>
                  {new Date(summary.generatedAt).toLocaleString()}
                </span>
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
