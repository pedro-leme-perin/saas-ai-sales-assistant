"use client";

import { useEffect, useRef } from "react";
import { presenceService } from "@/services/presence.service";
import { logger } from "@/lib/logger";

const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Sends a presence heartbeat every 30s while the tab is mounted + visible.
 * Pauses on `document.visibilitychange` to avoid noisy updates from background tabs.
 * Fail-open: heartbeat errors are swallowed so transient outages never break UX.
 */
export function usePresenceHeartbeat(enabled = true): void {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const send = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      presenceService.heartbeat().catch((err) => {
        logger.ui.warn("presence heartbeat failed", err);
      });
    };

    send();
    timerRef.current = setInterval(send, HEARTBEAT_INTERVAL_MS);

    const onVisibility = () => {
      if (!document.hidden) send();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);
}
