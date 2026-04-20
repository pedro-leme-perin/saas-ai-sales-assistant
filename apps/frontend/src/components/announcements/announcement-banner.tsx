"use client";

// =============================================
// 📢 AnnouncementBanner (Session 53)
// =============================================
// Dashboard-wide banner that surfaces active announcements for the current
// user and lets them read / dismiss inline. Polls every 2 minutes.

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, AlertTriangle, Siren, X } from "lucide-react";
import { announcementsService } from "@/services/announcements.service";

const LEVEL_COLORS = {
  INFO: {
    bg: "bg-blue-500/10 border-blue-500/30",
    text: "text-blue-900 dark:text-blue-200",
    icon: "text-blue-600 dark:text-blue-300",
  },
  WARNING: {
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-900 dark:text-amber-200",
    icon: "text-amber-600 dark:text-amber-300",
  },
  URGENT: {
    bg: "bg-red-500/10 border-red-500/30",
    text: "text-red-900 dark:text-red-200",
    icon: "text-red-600 dark:text-red-300",
  },
} as const;

export function AnnouncementBanner() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["announcements", "active"],
    queryFn: () => announcementsService.listActive(),
    refetchInterval: 2 * 60 * 1000,
    staleTime: 30_000,
  });

  const readMut = useMutation({
    mutationFn: (id: string) => announcementsService.markRead(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["announcements", "active"] }),
  });

  const dismissMut = useMutation({
    mutationFn: (id: string) => announcementsService.dismiss(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["announcements", "active"] }),
  });

  // Auto-mark as read when first seen.
  useEffect(() => {
    for (const item of items) {
      if (!item.isRead && !item.isDismissed) {
        readMut.mutate(item.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.id).join(",")]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const palette = LEVEL_COLORS[item.level];
        const Icon =
          item.level === "URGENT"
            ? Siren
            : item.level === "WARNING"
              ? AlertTriangle
              : Info;
        return (
          <div
            key={item.id}
            className={`flex items-start gap-3 rounded-lg border p-3 ${palette.bg} ${palette.text}`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${palette.icon}`} />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{item.title}</div>
              <p className="text-xs mt-0.5 whitespace-pre-line">
                {item.body}
              </p>
            </div>
            <button
              type="button"
              aria-label="dismiss"
              onClick={() => dismissMut.mutate(item.id)}
              className="shrink-0 rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default AnnouncementBanner;
