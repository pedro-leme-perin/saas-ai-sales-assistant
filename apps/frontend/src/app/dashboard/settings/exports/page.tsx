"use client";

// =============================================
// 📤 SCHEDULED EXPORTS PAGE (Session 51)
// =============================================

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Trash2,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  scheduledExportsService,
  type ScheduledExport,
  type ScheduledExportResource,
  type ScheduledExportFormat,
  type CreateScheduledExportInput,
} from "@/services/scheduled-exports.service";

const RESOURCES: ScheduledExportResource[] = [
  "ANALYTICS_OVERVIEW",
  "CONTACTS",
  "AUDIT_LOGS",
  "CALLS",
  "WHATSAPP_CHATS",
  "CSAT_RESPONSES",
];

const FORMATS: ScheduledExportFormat[] = ["CSV", "JSON"];

const CRON_PRESETS = [
  { value: "hourly", labelKey: "exports.cron.hourly" },
  { value: "daily:09:00", labelKey: "exports.cron.daily9" },
  { value: "weekly:1:08:00", labelKey: "exports.cron.weeklyMon" },
  { value: "monthly:1:08:00", labelKey: "exports.cron.monthly1" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function ScheduledExportsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["scheduled-exports"],
    queryFn: () => scheduledExportsService.list(),
  });

  const createMut = useMutation({
    mutationFn: (dto: CreateScheduledExportInput) =>
      scheduledExportsService.create(dto),
    onSuccess: () => {
      toast.success(t("exports.toast.created"));
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["scheduled-exports"] });
    },
    onError: () => toast.error(t("exports.toast.createErr")),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => scheduledExportsService.remove(id),
    onSuccess: () => {
      toast.success(t("exports.toast.deleted"));
      qc.invalidateQueries({ queryKey: ["scheduled-exports"] });
    },
    onError: () => toast.error(t("exports.toast.deleteErr")),
  });

  const runMut = useMutation({
    mutationFn: (id: string) => scheduledExportsService.runNow(id),
    onSuccess: () => {
      toast.success(t("exports.toast.scheduled"));
      qc.invalidateQueries({ queryKey: ["scheduled-exports"] });
    },
    onError: () => toast.error(t("exports.toast.runErr")),
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
            {t("exports.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("exports.subtitle")}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t("exports.new")}
        </Button>
      </div>

      {showForm && (
        <CreateExportForm
          onSubmit={(dto) => createMut.mutate(dto)}
          isSubmitting={createMut.isPending}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t("exports.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((ex) => (
            <ExportRow
              key={ex.id}
              item={ex}
              onRun={(id) => runMut.mutate(id)}
              onRemove={(id) => {
                if (confirm(t("exports.confirmDelete"))) removeMut.mutate(id);
              }}
              isRunning={runMut.isPending}
              isRemoving={removeMut.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExportRow({
  item,
  onRun,
  onRemove,
  isRunning,
  isRemoving,
}: {
  item: ScheduledExport;
  onRun: (id: string) => void;
  onRemove: (id: string) => void;
  isRunning: boolean;
  isRemoving: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium truncate">{item.name}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                {item.resource}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                {item.format}
              </span>
              {!item.isActive && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {t("exports.inactive")}
                </span>
              )}
              <StatusBadge status={item.lastRunStatus} />
            </div>
            <div className="mt-2 grid md:grid-cols-4 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">{t("exports.cronLabel")}: </span>
                <code>{item.cronExpression}</code>
              </div>
              <div>
                <span className="font-medium">{t("exports.nextRun")}: </span>
                {formatDate(item.nextRunAt)}
              </div>
              <div>
                <span className="font-medium">{t("exports.lastRun")}: </span>
                {formatDate(item.lastRunAt)}
              </div>
              <div>
                <span className="font-medium">{t("exports.runCount")}: </span>
                {item.runCount}
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium">{t("exports.recipients")}: </span>
              {item.recipients.join(", ")}
            </div>
            {item.lastError && (
              <div className="mt-2 text-xs text-red-500 font-mono truncate">
                {item.lastError}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRun(item.id)}
              disabled={isRunning}
            >
              <Play className="w-3.5 h-3.5 mr-1" />
              {t("exports.runNow")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRemove(item.id)}
              disabled={isRemoving}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ScheduledExport["lastRunStatus"] }) {
  const { t } = useTranslation();
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
        <Clock className="w-3 h-3" />
        {t("exports.status.pending")}
      </span>
    );
  }
  if (status === "OK") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle2 className="w-3 h-3" />
        {t("exports.status.ok")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <AlertTriangle className="w-3 h-3" />
      {t("exports.status.failed")}
    </span>
  );
}

function CreateExportForm({
  onSubmit,
  isSubmitting,
  onCancel,
}: {
  onSubmit: (dto: CreateScheduledExportInput) => void;
  isSubmitting: boolean;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [resource, setResource] = useState<ScheduledExportResource>(
    "ANALYTICS_OVERVIEW",
  );
  const [format, setFormat] = useState<ScheduledExportFormat>("CSV");
  const [cronExpression, setCronExpression] = useState("daily:09:00");
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [isActive, setIsActive] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const recipients = recipientsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (recipients.length === 0) return;
    onSubmit({
      name: name.trim(),
      resource,
      format,
      cronExpression: cronExpression.trim(),
      recipients,
      isActive,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("exports.new")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("exports.name")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={120}
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t("exports.resource")}
            </label>
            <select
              value={resource}
              onChange={(e) =>
                setResource(e.target.value as ScheduledExportResource)
              }
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
            >
              {RESOURCES.map((r) => (
                <option key={r} value={r}>
                  {t(`exports.resources.${r}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t("exports.format")}
            </label>
            <select
              value={format}
              onChange={(e) =>
                setFormat(e.target.value as ScheduledExportFormat)
              }
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("exports.cronLabel")}
            </label>
            <div className="flex gap-2 mt-1">
              <select
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className="px-3 py-2 rounded-lg border bg-background text-sm"
              >
                {CRON_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {t(p.labelKey)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm font-mono"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("exports.cronHint")}
            </p>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("exports.recipients")}
            </label>
            <input
              type="text"
              value={recipientsRaw}
              onChange={(e) => setRecipientsRaw(e.target.value)}
              placeholder="user@example.com, ops@example.com"
              required
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              {t("exports.isActive")}
            </label>
          </div>
          <div className="md:col-span-2 flex items-center justify-end gap-2 border-t pt-3">
            <Button variant="outline" type="button" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              )}
              {t("common.create")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
