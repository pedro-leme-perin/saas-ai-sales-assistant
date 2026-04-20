"use client";

// =============================================
// 📊 USAGE QUOTAS PAGE (Session 55 — Feature A2)
// =============================================

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Gauge, Loader2, Pencil, Save, X, Infinity as InfIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  usageQuotasService,
  type UsageMetric,
  type UsageQuota,
} from "@/services/usage-quotas.service";

const METRICS: UsageMetric[] = [
  "CALLS",
  "WHATSAPP_MESSAGES",
  "AI_SUGGESTIONS",
  "STORAGE_MB",
];

function pct(row: UsageQuota): number {
  if (row.limit <= 0) return 0;
  return Math.min(100, Math.floor((row.currentValue * 100) / row.limit));
}

function severity(row: UsageQuota): "ok" | "warn" | "crit" | "unlimited" {
  if (row.limit === -1) return "unlimited";
  const p = (row.currentValue * 100) / row.limit;
  if (p >= 100) return "crit";
  if (p >= 80) return "warn";
  return "ok";
}

const BAR_COLOR: Record<"ok" | "warn" | "crit" | "unlimited", string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  crit: "bg-red-500",
  unlimited: "bg-sky-500",
};

export default function UsageQuotasPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: quotas = [], isLoading } = useQuery({
    queryKey: ["usage-quotas"],
    queryFn: () => usageQuotasService.list(),
    refetchInterval: 30_000,
  });

  const upsertMut = useMutation({
    mutationFn: (dto: { metric: UsageMetric; limit: number }) =>
      usageQuotasService.upsertLimit(dto),
    onSuccess: () => {
      toast.success(t("usageQuotas.toast.updateOk"));
      qc.invalidateQueries({ queryKey: ["usage-quotas"] });
    },
    onError: () => toast.error(t("usageQuotas.toast.updateErr")),
  });

  const byMetric: Partial<Record<UsageMetric, UsageQuota>> = Object.fromEntries(
    quotas.map((q) => [q.metric, q]),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/settings"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("usageQuotas.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("usageQuotas.subtitle")}
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {METRICS.map((metric) => (
            <QuotaCard
              key={metric}
              metric={metric}
              row={byMetric[metric]}
              saving={upsertMut.isPending}
              onSave={(limit) => upsertMut.mutate({ metric, limit })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuotaCard({
  metric,
  row,
  saving,
  onSave,
}: {
  metric: UsageMetric;
  row: UsageQuota | undefined;
  saving: boolean;
  onSave: (limit: number) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draftLimit, setDraftLimit] = useState<string>(
    row ? String(row.limit) : "0",
  );

  const sev = row ? severity(row) : "ok";
  const percent = row ? pct(row) : 0;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Gauge className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {t(`usageQuotas.metrics.${metric}`)}
              </p>
              {row && (
                <p className="text-[11px] text-muted-foreground">
                  {new Date(row.periodStart).toLocaleDateString()} →{" "}
                  {new Date(row.periodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing((s) => !s);
              setDraftLimit(row ? String(row.limit) : "0");
            }}
          >
            {editing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {!row ? (
          <p className="text-xs text-muted-foreground">
            {t("usageQuotas.notProvisioned")}
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">
                {row.currentValue.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">
                {sev === "unlimited" ? (
                  <span className="flex items-center gap-1">
                    <InfIcon className="w-4 h-4" />
                    {t("usageQuotas.unlimited")}
                  </span>
                ) : (
                  <>/ {row.limit.toLocaleString()}</>
                )}
              </span>
            </div>
            {sev !== "unlimited" && (
              <>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${BAR_COLOR[sev]} transition-all`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-xs font-mono">
                  {percent}%
                  {sev === "warn" && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400">
                      {t("usageQuotas.nearLimit")}
                    </span>
                  )}
                  {sev === "crit" && (
                    <span className="ml-2 text-red-600 dark:text-red-400">
                      {t("usageQuotas.overLimit")}
                    </span>
                  )}
                </p>
              </>
            )}
          </>
        )}

        {editing && (
          <div className="pt-2 border-t space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("usageQuotas.newLimit")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={-1}
                value={draftLimit}
                onChange={(e) => setDraftLimit(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm font-mono"
              />
              <Button
                size="sm"
                disabled={saving}
                onClick={() => {
                  const n = Number(draftLimit);
                  if (!Number.isFinite(n)) return;
                  onSave(Math.trunc(n));
                  setEditing(false);
                }}
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1" />
                )}
                {t("common.save")}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("usageQuotas.limitHint")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
