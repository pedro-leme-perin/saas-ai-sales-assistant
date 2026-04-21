"use client";

// =============================================
// ⏱️ SLA POLICIES PAGE (Session 49)
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
  slaPoliciesService,
  type ChatPriority,
  type SlaPolicy,
} from "@/services/sla-policies.service";
import { EscalationTiers } from "@/components/sla/escalation-tiers";

const PRIORITIES: ChatPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

const DEFAULTS: Record<
  ChatPriority,
  { responseMins: number; resolutionMins: number }
> = {
  LOW: { responseMins: 240, resolutionMins: 2880 },
  NORMAL: { responseMins: 120, resolutionMins: 1440 },
  HIGH: { responseMins: 30, resolutionMins: 240 },
  URGENT: { responseMins: 5, resolutionMins: 60 },
};

type RowState = {
  name: string;
  responseMins: number;
  resolutionMins: number;
  isActive: boolean;
  existing: SlaPolicy | null;
  dirty: boolean;
  saving: boolean;
};

function defaultRow(priority: ChatPriority): RowState {
  return {
    name: `SLA ${priority}`,
    responseMins: DEFAULTS[priority].responseMins,
    resolutionMins: DEFAULTS[priority].resolutionMins,
    isActive: true,
    existing: null,
    dirty: false,
    saving: false,
  };
}

export default function SlaPoliciesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["sla-policies"],
    queryFn: () => slaPoliciesService.list(),
  });

  const [rows, setRows] = useState<Record<ChatPriority, RowState>>(() => {
    const r = {} as Record<ChatPriority, RowState>;
    for (const p of PRIORITIES) r[p] = defaultRow(p);
    return r;
  });

  useEffect(() => {
    const next: Record<ChatPriority, RowState> = {} as Record<
      ChatPriority,
      RowState
    >;
    for (const p of PRIORITIES) next[p] = defaultRow(p);
    for (const pol of policies) {
      next[pol.priority] = {
        name: pol.name,
        responseMins: pol.responseMins,
        resolutionMins: pol.resolutionMins,
        isActive: pol.isActive,
        existing: pol,
        dirty: false,
        saving: false,
      };
    }
    setRows(next);
  }, [policies]);

  const upsertMut = useMutation({
    mutationFn: (priority: ChatPriority) => {
      const r = rows[priority];
      return slaPoliciesService.upsert({
        name: r.name,
        priority,
        responseMins: r.responseMins,
        resolutionMins: r.resolutionMins,
        isActive: r.isActive,
      });
    },
    onMutate: (priority) => {
      setRows((prev) => ({
        ...prev,
        [priority]: { ...prev[priority], saving: true },
      }));
    },
    onSuccess: (_data, priority) => {
      toast.success(t("sla.toast.saveOk"));
      setRows((prev) => ({
        ...prev,
        [priority]: { ...prev[priority], dirty: false, saving: false },
      }));
      qc.invalidateQueries({ queryKey: ["sla-policies"] });
    },
    onError: (_err, priority) => {
      toast.error(t("sla.toast.saveErr"));
      setRows((prev) => ({
        ...prev,
        [priority]: { ...prev[priority], saving: false },
      }));
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => slaPoliciesService.remove(id),
    onSuccess: () => {
      toast.success(t("sla.toast.deleteOk"));
      qc.invalidateQueries({ queryKey: ["sla-policies"] });
    },
    onError: () => toast.error(t("sla.toast.deleteErr")),
  });

  function update<K extends keyof RowState>(
    priority: ChatPriority,
    key: K,
    value: RowState[K],
  ) {
    setRows((prev) => ({
      ...prev,
      [priority]: { ...prev[priority], [key]: value, dirty: true },
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
            {t("sla.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("sla.subtitle")}</p>
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
          {PRIORITIES.map((priority) => {
            const row = rows[priority];
            return (
              <Card key={priority}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${priorityColor(priority)}`}
                    />
                    {t(`sla.priority.${priority}`)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-5 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("sla.name")}
                    </label>
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => update(priority, "name", e.target.value)}
                      maxLength={120}
                      className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("sla.responseMins")}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10080}
                      value={row.responseMins}
                      onChange={(e) =>
                        update(
                          priority,
                          "responseMins",
                          Number(e.target.value) || 0,
                        )
                      }
                      className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("sla.resolutionMins")}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={43200}
                      value={row.resolutionMins}
                      onChange={(e) =>
                        update(
                          priority,
                          "resolutionMins",
                          Number(e.target.value) || 0,
                        )
                      }
                      className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.isActive}
                        onChange={(e) =>
                          update(priority, "isActive", e.target.checked)
                        }
                      />
                      {t("sla.active")}
                    </label>
                  </div>
                  <div className="md:col-span-5 flex items-center justify-end gap-2 border-t pt-3">
                    {row.existing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (
                            row.existing &&
                            confirm(t("sla.confirmDelete"))
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
                      onClick={() => upsertMut.mutate(priority)}
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
                  {row.existing && (
                    <div className="md:col-span-5 border-t pt-3">
                      <EscalationTiers
                        policyId={row.existing.id}
                        policyName={row.name}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{t("sla.hint")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function priorityColor(p: ChatPriority): string {
  switch (p) {
    case "LOW":
      return "bg-muted-foreground";
    case "NORMAL":
      return "bg-blue-500";
    case "HIGH":
      return "bg-amber-500";
    case "URGENT":
      return "bg-red-500";
  }
}
