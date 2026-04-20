"use client";

// =============================================
// 🧹 RETENTION POLICIES PAGE (Session 51)
// =============================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  retentionPoliciesService,
  RETENTION_RESOURCES,
  MIN_RETENTION_DAYS,
  type RetentionResource,
  type RetentionPolicy,
} from "@/services/retention-policies.service";

type RowState = {
  retentionDays: number;
  isActive: boolean;
  existing: RetentionPolicy | null;
  dirty: boolean;
  saving: boolean;
};

function defaultRow(resource: RetentionResource): RowState {
  return {
    retentionDays: Math.max(MIN_RETENTION_DAYS[resource], 30),
    isActive: false,
    existing: null,
    dirty: false,
    saving: false,
  };
}

export default function RetentionPoliciesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["retention-policies"],
    queryFn: () => retentionPoliciesService.list(),
  });

  const [rows, setRows] = useState<Record<RetentionResource, RowState>>(() => {
    const r = {} as Record<RetentionResource, RowState>;
    for (const res of RETENTION_RESOURCES) r[res] = defaultRow(res);
    return r;
  });

  useEffect(() => {
    const next = {} as Record<RetentionResource, RowState>;
    for (const res of RETENTION_RESOURCES) next[res] = defaultRow(res);
    for (const pol of policies) {
      next[pol.resource] = {
        retentionDays: pol.retentionDays,
        isActive: pol.isActive,
        existing: pol,
        dirty: false,
        saving: false,
      };
    }
    setRows(next);
  }, [policies]);

  const upsertMut = useMutation({
    mutationFn: (resource: RetentionResource) => {
      const r = rows[resource];
      return retentionPoliciesService.upsert({
        resource,
        retentionDays: r.retentionDays,
        isActive: r.isActive,
      });
    },
    onMutate: (resource) => {
      setRows((p) => ({
        ...p,
        [resource]: { ...p[resource], saving: true },
      }));
    },
    onSuccess: (_d, resource) => {
      toast.success(t("retention.toast.saveOk"));
      setRows((p) => ({
        ...p,
        [resource]: { ...p[resource], dirty: false, saving: false },
      }));
      qc.invalidateQueries({ queryKey: ["retention-policies"] });
    },
    onError: (_e, resource) => {
      toast.error(t("retention.toast.saveErr"));
      setRows((p) => ({
        ...p,
        [resource]: { ...p[resource], saving: false },
      }));
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => retentionPoliciesService.remove(id),
    onSuccess: () => {
      toast.success(t("retention.toast.deleteOk"));
      qc.invalidateQueries({ queryKey: ["retention-policies"] });
    },
    onError: () => toast.error(t("retention.toast.deleteErr")),
  });

  function update<K extends keyof RowState>(
    resource: RetentionResource,
    key: K,
    value: RowState[K],
  ) {
    setRows((p) => ({
      ...p,
      [resource]: { ...p[resource], [key]: value, dirty: true },
    }));
  }

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
            {t("retention.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("retention.subtitle")}
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
        <div className="grid gap-4">
          {RETENTION_RESOURCES.map((resource) => {
            const row = rows[resource];
            const floor = MIN_RETENTION_DAYS[resource];
            return (
              <Card key={resource}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t(`retention.resources.${resource}`)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("retention.days")}
                    </label>
                    <input
                      type="number"
                      min={floor}
                      max={3650}
                      value={row.retentionDays}
                      onChange={(e) =>
                        update(
                          resource,
                          "retentionDays",
                          Number(e.target.value) || floor,
                        )
                      }
                      className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("retention.floor", { days: String(floor) })}
                    </p>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.isActive}
                        onChange={(e) =>
                          update(resource, "isActive", e.target.checked)
                        }
                      />
                      {t("retention.active")}
                    </label>
                  </div>
                  <div className="md:col-span-2 text-xs text-muted-foreground">
                    {row.existing ? (
                      <>
                        <div>
                          {t("retention.lastRun")}:{" "}
                          {row.existing.lastRunAt
                            ? new Date(row.existing.lastRunAt).toLocaleString()
                            : "—"}
                        </div>
                        <div>
                          {t("retention.lastDeleted")}:{" "}
                          {row.existing.lastDeletedCount ?? 0}
                        </div>
                        {row.existing.lastError && (
                          <div className="text-red-500 font-mono truncate">
                            {row.existing.lastError}
                          </div>
                        )}
                      </>
                    ) : (
                      <div>{t("retention.notConfigured")}</div>
                    )}
                  </div>
                  <div className="md:col-span-4 flex items-center justify-end gap-2 border-t pt-3">
                    {row.existing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (
                            row.existing &&
                            confirm(t("retention.confirmDelete"))
                          ) {
                            removeMut.mutate(row.existing.id);
                          }
                        }}
                        disabled={removeMut.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        {t("common.delete")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => upsertMut.mutate(resource)}
                      disabled={!row.dirty || row.saving}
                    >
                      {row.saving ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5 mr-1" />
                      )}
                      {t("common.save")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{t("retention.hint")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
