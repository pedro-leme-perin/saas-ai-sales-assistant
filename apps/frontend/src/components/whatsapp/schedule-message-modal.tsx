"use client";

// =============================================
// 📅 SCHEDULE MESSAGE MODAL (Session 56 — Feature A1)
// =============================================
// Lightweight modal for scheduling a WhatsApp send.
// Client-side validation mirrors backend MIN_LEAD_SECONDS=30.

import { useState, useMemo } from "react";
import { CalendarClock, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  scheduledMessagesService,
  MIN_LEAD_SECONDS,
} from "@/services/scheduled-messages.service";
import { useTranslation } from "@/i18n/use-translation";

interface Props {
  chatId: string;
  open: boolean;
  onClose: () => void;
}

function toLocalInput(d: Date): string {
  // datetime-local expects YYYY-MM-DDTHH:mm (local, no tz)
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleMessageModal({ chatId, open, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const minLocal = useMemo(
    () => toLocalInput(new Date(Date.now() + MIN_LEAD_SECONDS * 1000)),
    [open],
  );

  const [content, setContent] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState(minLocal);

  const scheduleMut = useMutation({
    mutationFn: async () => {
      const iso = new Date(scheduledLocal).toISOString();
      const leadSec = (new Date(iso).getTime() - Date.now()) / 1000;
      if (leadSec < MIN_LEAD_SECONDS) {
        throw new Error("lead_too_short");
      }
      if (!content.trim()) {
        throw new Error("empty_content");
      }
      return scheduledMessagesService.schedule(chatId, {
        content: content.trim(),
        scheduledAt: iso,
      });
    },
    onSuccess: () => {
      toast.success(t("scheduledMessages.toast.scheduleOk"));
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
      setContent("");
      onClose();
    },
    onError: (err: Error) => {
      if (err.message === "lead_too_short") {
        toast.error(t("scheduledMessages.toast.leadTooShort"));
      } else if (err.message === "empty_content") {
        toast.error(t("scheduledMessages.toast.emptyContent"));
      } else {
        toast.error(t("scheduledMessages.toast.scheduleErr"));
      }
    },
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">
              {t("scheduledMessages.scheduleNew")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1">
              {t("scheduledMessages.scheduledAt")}
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={scheduledLocal}
              min={minLocal}
              onChange={(e) => setScheduledLocal(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {t("scheduledMessages.minLeadHint")}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">
              {t("scheduledMessages.content")}
            </label>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              rows={5}
              maxLength={4096}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("scheduledMessages.contentPh")}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {content.length}/4096
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={scheduleMut.isPending || !content.trim()}
              onClick={() => scheduleMut.mutate()}
            >
              {scheduleMut.isPending
                ? t("common.loading")
                : t("scheduledMessages.schedule")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScheduleMessageModal;
