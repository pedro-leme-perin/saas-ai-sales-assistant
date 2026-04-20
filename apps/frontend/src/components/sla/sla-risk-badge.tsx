// =============================================
// ⏱️ SLA RISK BADGE (Session 49)
// =============================================
// Shows amber "near SLA" when ≥70% of deadline elapsed, red "breached" when
// slaResponseBreached or slaResolutionBreached is set on the chat row.
// Safe to render with partial fields (returns null when missing).

"use client";

import { AlertTriangle, Clock } from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";

export interface SlaChatLike {
  createdAt?: string | Date | null;
  firstAgentReplyAt?: string | Date | null;
  closedAt?: string | Date | null;
  slaResponseBreached?: boolean;
  slaResolutionBreached?: boolean;
  slaResponseDeadline?: string | Date | null;
  slaResolutionDeadline?: string | Date | null;
}

function parseDate(d: string | Date | null | undefined): number | null {
  if (!d) return null;
  const ts = typeof d === "string" ? Date.parse(d) : d.getTime();
  return Number.isFinite(ts) ? ts : null;
}

export function SlaRiskBadge({ chat }: { chat: SlaChatLike }) {
  const { t } = useTranslation();
  if (chat.slaResponseBreached || chat.slaResolutionBreached) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-700 dark:text-red-300">
        <AlertTriangle className="w-3 h-3" />
        {t("sla.risk.breached")}
      </span>
    );
  }
  const now = Date.now();
  const createdAt = parseDate(chat.createdAt);
  if (!createdAt) return null;

  const responseDeadline = parseDate(chat.slaResponseDeadline);
  const resolutionDeadline = parseDate(chat.slaResolutionDeadline);

  const responseElapsed =
    !chat.firstAgentReplyAt && responseDeadline
      ? (now - createdAt) / (responseDeadline - createdAt)
      : 0;
  const resolutionElapsed =
    !chat.closedAt && resolutionDeadline
      ? (now - createdAt) / (resolutionDeadline - createdAt)
      : 0;

  const atRisk =
    (responseElapsed >= 0.7 && responseElapsed < 1) ||
    (resolutionElapsed >= 0.7 && resolutionElapsed < 1);
  if (!atRisk) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300">
      <Clock className="w-3 h-3" />
      {t("sla.risk.warn")}
    </span>
  );
}
