"use client";

// =============================================
// 🏆 Goals + Leaderboard Page (Session 45)
// =============================================
// Shows the team leaderboard ranked by composite goal progress.
// Managers (OWNER/ADMIN/MANAGER) can set weekly/monthly goals.
// Vendors can only view.
// =============================================

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import {
  Trophy,
  Target,
  Phone,
  Bot,
  MessageSquare,
  Loader2,
  Plus,
  X,
  Medal,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  goalsService,
  type GoalMetric,
  type GoalPeriodType,
  type LeaderboardRow,
} from "@/services/goals.service";
import { useTranslation } from "@/i18n/use-translation";

const METRIC_OPTIONS: GoalMetric[] = [
  "CALLS_TOTAL",
  "CALLS_COMPLETED",
  "CONVERSION_RATE",
  "AI_ADOPTION_RATE",
  "WHATSAPP_MESSAGES",
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 0) return <Medal className="h-5 w-5 text-yellow-500" aria-hidden />;
  if (rank === 1) return <Medal className="h-5 w-5 text-gray-400" aria-hidden />;
  if (rank === 2) return <Medal className="h-5 w-5 text-amber-700" aria-hidden />;
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-bold">
      {rank + 1}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    clamped >= 100
      ? "bg-green-500"
      : clamped >= 60
        ? "bg-primary"
        : clamped >= 30
          ? "bg-amber-500"
          : "bg-red-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full transition-all ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function LeaderboardRowCard({
  row,
  rank,
  t,
}: {
  row: LeaderboardRow;
  rank: number;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <RankBadge rank={rank} />
            <div className="min-w-0">
              <p className="truncate font-medium">{row.name}</p>
              <p className="truncate text-xs text-muted-foreground">{row.email}</p>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-2xl font-bold text-primary">{row.compositeScore}%</div>
            <div className="text-xs text-muted-foreground">
              {t("goals.leaderboard.composite")}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" aria-hidden />
              {t("goals.metrics.calls")}
            </div>
            <div className="text-sm font-semibold">
              {row.metrics.callsCompleted}/{row.metrics.callsTotal}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" aria-hidden />
              {t("goals.metrics.conversion")}
            </div>
            <div className="text-sm font-semibold">{row.metrics.conversionRate}%</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bot className="h-3 w-3" aria-hidden />
              {t("goals.metrics.aiAdoption")}
            </div>
            <div className="text-sm font-semibold">{row.metrics.aiAdoptionRate}%</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" aria-hidden />
              {t("goals.metrics.whatsapp")}
            </div>
            <div className="text-sm font-semibold">{row.metrics.whatsappMessagesSent}</div>
          </div>
        </div>

        {row.goals.length > 0 && (
          <div className="mt-4 space-y-2 border-t pt-3">
            {row.goals.map((g) => (
              <div key={g.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Target className="h-3 w-3" aria-hidden />
                    {t(`goals.metricLabel.${g.metric}`)}
                    {g.isCompanyWide && (
                      <span className="ml-1 rounded-sm bg-muted px-1.5 text-[10px]">
                        {t("goals.teamWide")}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {g.current} / {g.target} · {g.progressPct}%
                  </span>
                </div>
                <ProgressBar value={g.progressPct} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateGoalModal({
  open,
  onClose,
  onSuccess,
  period,
  vendors,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  period: GoalPeriodType;
  vendors: Array<{ id: string; name: string }>;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const [metric, setMetric] = useState<GoalMetric>("CALLS_COMPLETED");
  const [target, setTarget] = useState<number>(20);
  const [userId, setUserId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      goalsService.create({
        metric,
        target,
        periodType: period,
        ...(userId ? { userId } : {}),
      }),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? t("common.error"));
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("goals.create.title")}</h2>
          <button onClick={onClose} aria-label={t("common.close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t("goals.create.metric")}
            </label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as GoalMetric)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {METRIC_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {t(`goals.metricLabel.${m}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t("goals.create.target")}
            </label>
            <input
              type="number"
              min={1}
              max={100000}
              value={target}
              onChange={(e) => setTarget(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {metric === "CONVERSION_RATE" || metric === "AI_ADOPTION_RATE"
                ? t("goals.create.hintPercent")
                : t("goals.create.hintCount")}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t("goals.create.assignee")}
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t("goals.create.teamWide")}</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                setError(null);
                mutation.mutate();
              }}
              disabled={mutation.isPending || target <= 0}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {t("goals.create.submit")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const { t } = useTranslation();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<GoalPeriodType>("WEEKLY");
  const [createOpen, setCreateOpen] = useState(false);

  // Clerk role comes via publicMetadata — treat missing/vendor as non-manager.
  const role = (user?.publicMetadata?.role as string | undefined) ?? "VENDOR";
  const isManager = role === "OWNER" || role === "ADMIN" || role === "MANAGER";

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["goals", "leaderboard", period],
    queryFn: () => goalsService.leaderboard(period),
  });

  const vendors = useMemo(
    () => leaderboard?.rows.map((r) => ({ id: r.userId, name: r.name })) ?? [],
    [leaderboard],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <Trophy className="h-6 w-6 text-primary" aria-hidden />
            {t("goals.title")}
          </h1>
          <p className="text-muted-foreground">{t("goals.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border">
            <button
              onClick={() => setPeriod("WEEKLY")}
              className={`px-3 py-1.5 text-xs ${
                period === "WEEKLY" ? "bg-primary text-primary-foreground" : ""
              }`}
            >
              {t("goals.period.weekly")}
            </button>
            <button
              onClick={() => setPeriod("MONTHLY")}
              className={`px-3 py-1.5 text-xs ${
                period === "MONTHLY" ? "bg-primary text-primary-foreground" : ""
              }`}
            >
              {t("goals.period.monthly")}
            </button>
          </div>
          {isManager && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t("goals.create.button")}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t("common.loading")}
        </div>
      ) : !leaderboard || leaderboard.rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("goals.empty.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("goals.empty.description")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {leaderboard.rows.map((row, i) => (
            <LeaderboardRowCard key={row.userId} row={row} rank={i} t={t} />
          ))}
        </div>
      )}

      <CreateGoalModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ["goals", "leaderboard"] })
        }
        period={period}
        vendors={vendors}
        t={t}
      />
    </div>
  );
}
