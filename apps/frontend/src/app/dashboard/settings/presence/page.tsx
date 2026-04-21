"use client";

// =============================================
// 🟢 AGENT PRESENCE PAGE (Session 57 — Feature A1)
// =============================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import { PresenceIndicator } from "@/components/presence/presence-indicator";
import { usePresenceHeartbeat } from "@/hooks/use-presence-heartbeat";
import {
  presenceService,
  type AgentStatus,
  type PresenceRow,
  type UpdatePresencePayload,
} from "@/services/presence.service";

const STATUSES: AgentStatus[] = ["ONLINE", "AWAY", "BREAK", "OFFLINE"];

export default function PresencePage() {
  const { t, locale } = useTranslation();
  const qc = useQueryClient();

  usePresenceHeartbeat(true);

  const { data: mine, isLoading: loadingMine } = useQuery({
    queryKey: ["presence", "me"],
    queryFn: () => presenceService.findMine(),
    retry: false,
  });

  const { data: activeList = [], isLoading: loadingList } = useQuery({
    queryKey: ["presence", "active"],
    queryFn: () => presenceService.listActive(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const [form, setForm] = useState<{
    status: AgentStatus;
    statusMessage: string;
    maxConcurrentChats: number;
  }>({ status: "ONLINE", statusMessage: "", maxConcurrentChats: 5 });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (mine) {
      setForm({
        status: mine.status,
        statusMessage: mine.statusMessage ?? "",
        maxConcurrentChats: mine.maxConcurrentChats,
      });
      setDirty(false);
    }
  }, [mine]);

  const updateMut = useMutation({
    mutationFn: (payload: UpdatePresencePayload) =>
      presenceService.updateMine(payload),
    onSuccess: () => {
      toast.success(t("presence.toast.saveOk"));
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["presence"] });
    },
    onError: () => toast.error(t("presence.toast.saveErr")),
  });

  function updateField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  const dateFmt = new Intl.DateTimeFormat(locale ?? "pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  function formatLastSeen(iso: string | null | undefined): string {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      const diffMs = Date.now() - d.getTime();
      if (diffMs < 60_000) return t("presence.now");
      if (diffMs < 3_600_000)
        return t("presence.minutesAgo", {
          n: String(Math.floor(diffMs / 60_000)),
        });
      return dateFmt.format(d);
    } catch {
      return "—";
    }
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
            {t("presence.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("presence.subtitle")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("presence.myStatus")}</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t("presence.status.label")}
            </label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateField("status", s)}
                  disabled={loadingMine}
                  className={`px-3 py-2 rounded-lg border text-sm transition-colors flex items-center gap-2 justify-center ${
                    form.status === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <PresenceIndicator status={s} size="sm" />
                  {t(`presence.status.${s}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t("presence.statusMessage")}
            </label>
            <input
              type="text"
              value={form.statusMessage}
              onChange={(e) => updateField("statusMessage", e.target.value)}
              maxLength={200}
              placeholder={t("presence.statusMessagePh")}
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t("presence.maxConcurrentChats")}
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={form.maxConcurrentChats}
              onChange={(e) =>
                updateField(
                  "maxConcurrentChats",
                  Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                )
              }
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {t("presence.maxHint")}
            </p>
          </div>

          <div className="md:col-span-2 flex items-center justify-end gap-2 border-t pt-3">
            <Button
              size="sm"
              disabled={!dirty || updateMut.isPending}
              onClick={() =>
                updateMut.mutate({
                  status: form.status,
                  statusMessage: form.statusMessage.trim() || null,
                  maxConcurrentChats: form.maxConcurrentChats,
                })
              }
            >
              {updateMut.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1" />
              )}
              {t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("presence.team")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("common.loading")}
            </p>
          ) : activeList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("presence.empty")}
            </p>
          ) : (
            <div className="divide-y">
              {activeList.map((row: PresenceRow) => {
                const name =
                  [row.user?.firstName, row.user?.lastName]
                    .filter(Boolean)
                    .join(" ") ||
                  row.user?.email ||
                  row.userId;
                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PresenceIndicator status={row.status} size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        {row.statusMessage && (
                          <p className="text-xs text-muted-foreground truncate">
                            {row.statusMessage}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0 ml-2">
                      <p className="font-medium text-foreground/80">
                        {t(`presence.status.${row.status}`)}
                      </p>
                      <p>{formatLastSeen(row.lastHeartbeatAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
