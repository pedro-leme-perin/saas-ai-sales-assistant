"use client";

// =============================================
// 📅 SCHEDULED MESSAGES LIST PAGE (Session 56 — Feature A1)
// =============================================
// Tenant-wide list of scheduled WhatsApp sends. Cancel PENDING rows.

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  Loader2,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Ban,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import {
  scheduledMessagesService,
  type ScheduledMessage,
  type ScheduledMessageStatus,
} from "@/services/scheduled-messages.service";

const STATUS_ICON: Record<ScheduledMessageStatus, typeof CalendarClock> = {
  PENDING: CalendarClock,
  SENT: CheckCircle2,
  FAILED: AlertTriangle,
  CANCELED: Ban,
};

const STATUS_COLOR: Record<ScheduledMessageStatus, string> = {
  PENDING: "text-amber-500",
  SENT: "text-emerald-500",
  FAILED: "text-red-500",
  CANCELED: "text-muted-foreground",
};

export default function ScheduledMessagesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] =
    useState<ScheduledMessageStatus | "">("");

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["scheduled-messages", statusFilter],
    queryFn: () =>
      scheduledMessagesService.list(
        statusFilter ? { status: statusFilter } : {},
      ),
    refetchInterval: 15_000,
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => scheduledMessagesService.cancel(id),
    onSuccess: () => {
      toast.success(t("scheduledMessages.toast.cancelOk"));
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
    },
    onError: () => toast.error(t("scheduledMessages.toast.cancelErr")),
  });

  return (
    <div className="p-6 space-y-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("common.back")}
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-primary" />
            {t("scheduledMessages.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("scheduledMessages.subtitle")}
          </p>
        </div>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as ScheduledMessageStatus | "")
          }
        >
          <option value="">{t("common.all")}</option>
          {(["PENDING", "SENT", "FAILED", "CANCELED"] as ScheduledMessageStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {t(`scheduledMessages.status.${s}`)}
              </option>
            ),
          )}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {t("scheduledMessages.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {messages.map((m: ScheduledMessage) => (
            <Row
              key={m.id}
              msg={m}
              onCancel={() => {
                if (confirm(t("scheduledMessages.confirmCancel"))) {
                  cancelMut.mutate(m.id);
                }
              }}
              disabled={cancelMut.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  msg,
  onCancel,
  disabled,
}: {
  msg: ScheduledMessage;
  onCancel: () => void;
  disabled: boolean;
}) {
  const { t, locale } = useTranslation();
  const Icon = STATUS_ICON[msg.status];
  const color = STATUS_COLOR[msg.status];

  const scheduledLabel = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(msg.scheduledAt));

  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium ${color}`}>
              {t(`scheduledMessages.status.${msg.status}`)}
            </span>
            <span className="text-xs text-muted-foreground">
              {scheduledLabel}
            </span>
            {msg.runCount > 0 && (
              <span className="text-xs text-muted-foreground">
                · {t("scheduledMessages.runCount")}: {msg.runCount}
              </span>
            )}
          </div>
          <p className="text-sm mt-1 line-clamp-2 whitespace-pre-wrap">
            {msg.content}
          </p>
          {msg.lastError && (
            <p className="text-[11px] text-red-500 mt-1 font-mono line-clamp-1">
              {msg.lastError}
            </p>
          )}
        </div>
        {msg.status === "PENDING" && (
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={disabled}
            className="gap-1"
          >
            <XCircle className="w-4 h-4" />
            {t("scheduledMessages.cancelAction")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
