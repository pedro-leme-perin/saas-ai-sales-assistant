"use client";

// =============================================
// ⚙️ BACKGROUND JOBS PAGE (Session 49)
// =============================================

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Play,
  XCircle,
  RefreshCw,
  Plus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  backgroundJobsService,
  type BackgroundJob,
  type BackgroundJobStatus,
  type BackgroundJobType,
} from "@/services/background-jobs.service";

const JOB_TYPES: BackgroundJobType[] = [
  "REGENERATE_CALL_SUMMARIES",
  "RECOMPUTE_COACHING_REPORTS",
  "BULK_DELETE_CALLS",
  "BULK_TAG_CALLS",
  "BULK_ASSIGN_CHATS",
  "EXPORT_ANALYTICS",
];

const STATUS_FILTERS: Array<BackgroundJobStatus | "ALL"> = [
  "ALL",
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "DEAD_LETTER",
  "CANCELED",
];

function statusIcon(s: BackgroundJobStatus) {
  switch (s) {
    case "PENDING":
      return <Clock className="w-4 h-4 text-muted-foreground" />;
    case "RUNNING":
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case "SUCCEEDED":
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case "FAILED":
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "DEAD_LETTER":
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case "CANCELED":
      return <Ban className="w-4 h-4 text-muted-foreground" />;
  }
}

function statusBadgeClass(s: BackgroundJobStatus): string {
  switch (s) {
    case "PENDING":
      return "bg-muted text-foreground";
    case "RUNNING":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "SUCCEEDED":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "DEAD_LETTER":
      return "bg-red-500/10 text-red-700 dark:text-red-300";
    case "CANCELED":
      return "bg-muted text-muted-foreground";
  }
}

export default function BackgroundJobsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<BackgroundJobStatus | "ALL">(
    "ALL",
  );
  const [typeFilter, setTypeFilter] = useState<BackgroundJobType | "ALL">(
    "ALL",
  );
  const [showEnqueue, setShowEnqueue] = useState(false);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["background-jobs", statusFilter, typeFilter],
    queryFn: () =>
      backgroundJobsService.list({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        type: typeFilter === "ALL" ? undefined : typeFilter,
        limit: 100,
      }),
    refetchInterval: 5_000,
  });

  const retryMut = useMutation({
    mutationFn: (id: string) => backgroundJobsService.retry(id),
    onSuccess: () => {
      toast.success(t("jobs.toast.retryOk"));
      qc.invalidateQueries({ queryKey: ["background-jobs"] });
    },
    onError: () => toast.error(t("jobs.toast.retryErr")),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => backgroundJobsService.cancel(id),
    onSuccess: () => {
      toast.success(t("jobs.toast.cancelOk"));
      qc.invalidateQueries({ queryKey: ["background-jobs"] });
    },
    onError: () => toast.error(t("jobs.toast.cancelErr")),
  });

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
            {t("jobs.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("jobs.subtitle")}</p>
        </div>
        <Button onClick={() => setShowEnqueue(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          {t("jobs.enqueue")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2">
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/70"
                }`}
              >
                {s === "ALL" ? t("common.all") : t(`jobs.status.${s}`)}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as BackgroundJobType | "ALL")
            }
            className="px-3 py-1 rounded-lg border bg-background text-sm"
          >
            <option value="ALL">{t("common.all")}</option>
            {JOB_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`jobs.types.${ty}`)}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t("jobs.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              onRetry={() => retryMut.mutate(job.id)}
              onCancel={() => cancelMut.mutate(job.id)}
              retrying={retryMut.isPending}
              canceling={cancelMut.isPending}
            />
          ))}
        </div>
      )}

      {showEnqueue && (
        <EnqueueModal
          onClose={() => setShowEnqueue(false)}
          onDone={() => {
            setShowEnqueue(false);
            qc.invalidateQueries({ queryKey: ["background-jobs"] });
          }}
        />
      )}
    </div>
  );
}

function JobRow({
  job,
  onRetry,
  onCancel,
  retrying,
  canceling,
}: {
  job: BackgroundJob;
  onRetry: () => void;
  onCancel: () => void;
  retrying: boolean;
  canceling: boolean;
}) {
  const { t } = useTranslation();
  const canRetry = job.status === "FAILED" || job.status === "DEAD_LETTER";
  const canCancel = job.status === "PENDING" || job.status === "RUNNING";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="pt-1">{statusIcon(job.status)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">
                {t(`jobs.types.${job.type}`)}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadgeClass(job.status)}`}
              >
                {t(`jobs.status.${job.status}`)}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(job.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, job.progress)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {job.progress}%
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {job.attempts}/{job.maxAttempts}
              </span>
            </div>
            {job.lastError && (
              <p className="mt-2 text-xs text-red-500 font-mono truncate">
                {job.lastError}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                disabled={retrying}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                {t("jobs.retry")}
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCancel}
                disabled={canceling}
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                {t("jobs.cancel")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EnqueueModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<BackgroundJobType>(JOB_TYPES[0]);
  const [payloadStr, setPayloadStr] = useState("{}");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(payloadStr || "{}");
    } catch {
      toast.error(t("jobs.toast.payloadErr"));
      return;
    }
    setSubmitting(true);
    try {
      await backgroundJobsService.enqueue({ type, payload });
      toast.success(t("jobs.toast.enqueueOk"));
      onDone();
    } catch {
      toast.error(t("jobs.toast.enqueueErr"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <CardTitle>{t("jobs.enqueue")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">{t("jobs.type")}</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as BackgroundJobType)}
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
            >
              {JOB_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`jobs.types.${ty}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">{t("jobs.payload")}</label>
            <textarea
              value={payloadStr}
              onChange={(e) => setPayloadStr(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm font-mono"
              rows={6}
              placeholder='{"sinceDays": 7}'
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("jobs.payloadHint")}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {t("jobs.enqueue")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
