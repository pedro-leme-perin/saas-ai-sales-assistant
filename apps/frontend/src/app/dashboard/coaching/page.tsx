"use client";

// =============================================
// 📄 Coaching Page
// =============================================
// Session 44 — lists the vendor's weekly AI coaching reports with full
// detail rendered inline (metrics grid, insights, recommendations).
// =============================================

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  TrendingUp,
  MessageSquare,
  PhoneOff,
  Bot,
  ChevronRight,
  Loader2,
  Inbox,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { coachingService, type CoachingReport } from "@/services/coaching.service";
import { useTranslation } from "@/i18n/use-translation";

function formatWeek(start: string, end: string, locale: string): string {
  const s = new Date(start);
  // end is exclusive (next Monday 00:00Z); subtract 1ms to render Sunday.
  const e = new Date(new Date(end).getTime() - 1);
  const fmt = new Intl.DateTimeFormat(locale === "pt-BR" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "short",
  });
  return `${fmt.format(s)} — ${fmt.format(e)}`;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function MetricCell({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "danger" | "primary";
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "primary"
        ? "text-primary"
        : "text-foreground";
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ReportDetail({
  report,
  onBack,
  locale,
  t,
}: {
  report: CoachingReport;
  onBack: () => void;
  locale: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const m = report.metrics;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={t("common.back")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{t("coaching.detail.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {formatWeek(report.weekStart, report.weekEnd, locale)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCell
          icon={TrendingUp}
          label={t("coaching.metrics.calls")}
          value={`${m.calls.completed}/${m.calls.total}`}
          hint={`${t("coaching.metrics.conversion")} ${pct(m.calls.conversionRate)}`}
          tone="primary"
        />
        <MetricCell
          icon={MessageSquare}
          label={t("coaching.metrics.whatsapp")}
          value={String(m.whatsapp.messagesSent)}
          hint={`${m.whatsapp.chats} ${t("coaching.metrics.chats")}`}
        />
        <MetricCell
          icon={Bot}
          label={t("coaching.metrics.aiAdoption")}
          value={pct(m.ai.adoptionRate)}
          hint={`${m.ai.suggestionsUsed}/${m.ai.suggestionsShown}`}
        />
        <MetricCell
          icon={PhoneOff}
          label={t("coaching.metrics.missed")}
          value={String(m.calls.missed)}
          tone="danger"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            {t("coaching.detail.insights")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {report.insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("coaching.detail.none")}</p>
          ) : (
            <ul className="space-y-2">
              {report.insights.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" aria-hidden />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            {t("coaching.detail.recommendations")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {report.recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("coaching.detail.none")}</p>
          ) : (
            <ol className="space-y-2">
              {report.recommendations.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        {t("coaching.detail.provider")}: {report.provider}
        {report.emailSentAt && (
          <>
            {" · "}
            {t("coaching.detail.emailSent")}:{" "}
            {new Date(report.emailSentAt).toLocaleString()}
          </>
        )}
      </div>
    </div>
  );
}

export default function CoachingPage() {
  const { t, locale } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["coaching", "me"],
    queryFn: () => coachingService.listMine(12),
  });

  const reports: CoachingReport[] = useMemo(() => data?.data ?? [], [data]);
  const selected = reports.find((r) => r.id === selectedId) ?? null;

  if (selected) {
    return (
      <ReportDetail
        report={selected}
        onBack={() => setSelectedId(null)}
        locale={locale}
        t={t}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("coaching.title")}
        </h1>
        <p className="text-muted-foreground">{t("coaching.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t("common.loading")}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="mb-4 h-14 w-14 text-muted-foreground/30" />
            <h3 className="text-lg font-medium">{t("coaching.empty.title")}</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {t("coaching.empty.description")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => {
            const adoption = pct(r.metrics.ai.adoptionRate);
            const conversion = pct(r.metrics.calls.conversionRate);
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className="group w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {formatWeek(r.weekStart, r.weekEnd, locale)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.metrics.calls.total} {t("coaching.list.calls")} ·{" "}
                        {r.metrics.whatsapp.messagesSent} {t("coaching.list.messages")} ·{" "}
                        {t("coaching.list.aiAdoption")} {adoption} ·{" "}
                        {t("coaching.list.conversion")} {conversion}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
