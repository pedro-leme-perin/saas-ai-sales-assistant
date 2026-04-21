"use client";

import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/services/presence.service";
import { useTranslation } from "@/i18n/use-translation";

interface PresenceIndicatorProps {
  status: AgentStatus;
  size?: "sm" | "md" | "lg";
  withLabel?: boolean;
  className?: string;
}

const STATUS_COLOR: Record<AgentStatus, string> = {
  ONLINE: "bg-emerald-500",
  AWAY: "bg-amber-500",
  BREAK: "bg-blue-500",
  OFFLINE: "bg-slate-400 dark:bg-slate-600",
};

const STATUS_RING: Record<AgentStatus, string> = {
  ONLINE: "ring-emerald-500/30",
  AWAY: "ring-amber-500/30",
  BREAK: "ring-blue-500/30",
  OFFLINE: "ring-slate-400/30",
};

const SIZE_MAP: Record<NonNullable<PresenceIndicatorProps["size"]>, string> = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
};

export function PresenceIndicator({
  status,
  size = "md",
  withLabel = false,
  className,
}: PresenceIndicatorProps) {
  const { t } = useTranslation();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        className,
      )}
      aria-label={t(`presence.status.${status}`)}
    >
      <span
        className={cn(
          "inline-block rounded-full ring-2",
          SIZE_MAP[size],
          STATUS_COLOR[status],
          STATUS_RING[status],
          status === "ONLINE" && "animate-pulse",
        )}
      />
      {withLabel && (
        <span className="text-xs font-medium text-foreground/80">
          {t(`presence.status.${status}`)}
        </span>
      )}
    </span>
  );
}
