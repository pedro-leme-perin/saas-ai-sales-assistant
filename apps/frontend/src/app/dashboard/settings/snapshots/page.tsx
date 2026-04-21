"use client";

// =============================================
// 📸 Config snapshots (Session 58 — Feature A2)
// =============================================

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  History,
  Loader2,
  Camera,
  RotateCcw,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  configSnapshotsService,
  type ConfigResource,
  type ConfigSnapshot,
  type SnapshotDiff,
} from "@/services/config-snapshots.service";

const RESOURCES: ConfigResource[] = [
  "COMPANY_SETTINGS",
  "FEATURE_FLAG",
  "SLA_POLICY",
  "ASSIGNMENT_RULE",
  "NOTIFICATION_PREFERENCES",
];

export default function SnapshotsPage() {
  const { t, locale } = useTranslation();
  const qc = useQueryClient();

  const [resourceFilter, setResourceFilter] = useState<ConfigResource | "">("");
  const [resourceIdFilter, setResourceIdFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmRollback, setConfirmRollback] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createResource, setCreateResource] =
    useState<ConfigResource>("COMPANY_SETTINGS");
  const [createResourceId, setCreateResourceId] = useState("");
  const [createLabel, setCreateLabel] = useState("");

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: [
      "snapshots",
      "list",
      resourceFilter || null,
      resourceIdFilter || null,
    ],
    queryFn: () =>
      configSnapshotsService.list({
        resource: resourceFilter || undefined,
        resourceId: resourceIdFilter || undefined,
        limit: 100,
      }),
    retry: false,
  });

  const { data: diff, isLoading: loadingDiff } = useQuery({
    queryKey: ["snapshots", "diff", selectedId],
    queryFn: () => configSnapshotsService.diff(selectedId as string),
    enabled: Boolean(selectedId),
    retry: false,
  });

  const createMut = useMutation({
    mutationFn: () =>
      configSnapshotsService.create({
        resource: createResource,
        resourceId: createResourceId || undefined,
        label: createLabel || undefined,
      }),
    onSuccess: () => {
      toast.success(t("snapshots.toast.createOk"));
      setCreateOpen(false);
      setCreateResourceId("");
      setCreateLabel("");
      qc.invalidateQueries({ queryKey: ["snapshots"] });
    },
    onError: () => toast.error(t("snapshots.toast.createErr")),
  });

  const rollbackMut = useMutation({
    mutationFn: (id: string) => configSnapshotsService.rollback(id),
    onSuccess: () => {
      toast.success(t("snapshots.toast.rollbackOk"));
      setConfirmRollback(null);
      qc.invalidateQueries({ queryKey: ["snapshots"] });
      setSelectedId(null);
    },
    onError: () => toast.error(t("snapshots.toast.rollbackErr")),
  });

  const dtFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });

  const selected = useMemo(
    () => snapshots.find((s: ConfigSnapshot) => s.id === selectedId) ?? null,
    [snapshots, selectedId],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("common.back")}
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            {t("snapshots.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("snapshots.subtitle")}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen((v) => !v)}>
          <Camera className="w-4 h-4 mr-2" />
          {t("snapshots.new")}
        </Button>
      </div>

      {createOpen && (
        <Card>
          <CardHeader>
            <CardTitle>{t("snapshots.createTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium block mb-1">
                {t("snapshots.resource")}
              </label>
              <select
                className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                value={createResource}
                onChange={(e) =>
                  setCreateResource(e.target.value as ConfigResource)
                }
              >
                {RESOURCES.map((r) => (
                  <option key={r} value={r}>
                    {t(`snapshots.resources.${r}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">
                {t("snapshots.resourceId")}
              </label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                value={createResourceId}
                onChange={(e) => setCreateResourceId(e.target.value)}
                placeholder={t("snapshots.resourceIdPh")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("snapshots.resourceIdHint")}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">
                {t("snapshots.label")}
              </label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                value={createLabel}
                onChange={(e) => setCreateLabel(e.target.value)}
                placeholder={t("snapshots.labelPh")}
                maxLength={200}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending}
              >
                {createMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Camera className="w-4 h-4 mr-2" />
                )}
                {t("snapshots.create")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-medium block mb-1">
              {t("snapshots.filter.resource")}
            </label>
            <select
              className="border rounded-md px-3 py-1.5 bg-background text-sm"
              value={resourceFilter}
              onChange={(e) =>
                setResourceFilter(e.target.value as ConfigResource | "")
              }
            >
              <option value="">{t("common.all")}</option>
              {RESOURCES.map((r) => (
                <option key={r} value={r}>
                  {t(`snapshots.resources.${r}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">
              {t("snapshots.filter.resourceId")}
            </label>
            <input
              type="text"
              className="border rounded-md px-3 py-1.5 bg-background text-sm"
              value={resourceIdFilter}
              onChange={(e) => setResourceIdFilter(e.target.value)}
              placeholder={t("snapshots.filter.resourceIdPh")}
            />
          </div>
          {(resourceFilter || resourceIdFilter) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setResourceFilter("");
                setResourceIdFilter("");
              }}
            >
              {t("common.reset")}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {t("snapshots.timeline")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : snapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("snapshots.empty")}
              </p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {snapshots.map((s: ConfigSnapshot) => {
                  const isSelected = s.id === selectedId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={`w-full text-left p-3 rounded-md border transition-colors ${
                        isSelected
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted">
                          {t(`snapshots.resources.${s.resource}`)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {dtFmt.format(new Date(s.createdAt))}
                        </span>
                      </div>
                      {s.label && (
                        <p className="text-sm mt-1 truncate">{s.label}</p>
                      )}
                      {s.resourceId && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          id: <code className="font-mono">{s.resourceId}</code>
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="w-4 h-4" />
              {t("snapshots.diffTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedId ? (
              <p className="text-sm text-muted-foreground">
                {t("snapshots.selectHint")}
              </p>
            ) : loadingDiff ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : diff ? (
              <DiffView
                diff={diff}
                onRollback={() => setConfirmRollback(selectedId)}
                rollbackPending={rollbackMut.isPending}
                selected={selected}
                dtFmt={dtFmt}
              />
            ) : (
              <p className="text-sm text-red-500">{t("snapshots.diffErr")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {confirmRollback && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                {t("snapshots.rollbackConfirm")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{t("snapshots.rollbackWarn")}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => rollbackMut.mutate(confirmRollback)}
                  disabled={rollbackMut.isPending}
                >
                  {rollbackMut.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <RotateCcw className="w-4 h-4 mr-2" />
                  )}
                  {t("snapshots.rollback")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmRollback(null)}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function DiffView({
  diff,
  onRollback,
  rollbackPending,
  selected,
  dtFmt,
}: {
  diff: SnapshotDiff;
  onRollback: () => void;
  rollbackPending: boolean;
  selected: ConfigSnapshot | null;
  dtFmt: Intl.DateTimeFormat;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs">
          <span className="font-medium">{t("snapshots.status")}:</span>{" "}
          {diff.changed ? (
            <span className="text-amber-600">{t("snapshots.changed")}</span>
          ) : (
            <span className="text-emerald-600">{t("snapshots.unchanged")}</span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onRollback}
          disabled={rollbackPending || !diff.changed}
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          {t("snapshots.rollback")}
        </Button>
      </div>
      {selected && (
        <p className="text-xs text-muted-foreground">
          {t("snapshots.createdAt")}: {dtFmt.format(new Date(selected.createdAt))}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="font-medium mb-1">{t("snapshots.snapshotData")}</p>
          <pre className="p-3 bg-muted rounded max-h-[400px] overflow-auto font-mono">
            {JSON.stringify(diff.snapshotData, null, 2)}
          </pre>
        </div>
        <div>
          <p className="font-medium mb-1">{t("snapshots.currentData")}</p>
          <pre className="p-3 bg-muted rounded max-h-[400px] overflow-auto font-mono">
            {JSON.stringify(diff.currentData, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
