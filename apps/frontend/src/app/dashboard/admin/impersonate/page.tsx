"use client";

// =============================================
// 🎭 Admin impersonation (Session 58 — Feature A1)
// =============================================

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Eye,
  Loader2,
  Copy,
  Check,
  X,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  impersonationService,
  type StartImpersonationResult,
  type ImpersonationSession,
} from "@/services/impersonation.service";
import { usersService } from "@/services/api";

const MIN_DURATION = 5;
const MAX_DURATION = 240;
const DEFAULT_DURATION = 30;
const MIN_REASON = 10;
const MAX_REASON = 500;

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

function canImpersonate(actorRole: string, targetRole: string): boolean {
  if (actorRole === "OWNER") return targetRole !== "OWNER";
  if (actorRole === "ADMIN")
    return targetRole === "MANAGER" || targetRole === "VENDOR";
  return false;
}

export default function ImpersonatePage() {
  const { t, locale } = useTranslation();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const actorRole = user?.role ?? "VENDOR";

  const { data: usersResp, isLoading: loadingUsers } = useQuery({
    queryKey: ["users", "list", 200],
    queryFn: () => usersService.getAll({ page: 1, limit: 200 }),
    retry: false,
  });

  const eligibleUsers = useMemo<UserRow[]>(() => {
    const list = (usersResp as { data?: UserRow[] } | undefined)?.data ?? [];
    return list.filter(
      (u) => u.id !== user?.id && canImpersonate(actorRole, u.role),
    );
  }, [usersResp, user?.id, actorRole]);

  const { data: activeSessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["impersonation", "active", user?.id],
    queryFn: () => impersonationService.listActive(user?.id),
    refetchInterval: 30_000,
    retry: false,
  });

  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_DURATION);
  const [issued, setIssued] = useState<StartImpersonationResult | null>(null);
  const [copied, setCopied] = useState(false);

  const startMut = useMutation({
    mutationFn: () =>
      impersonationService.start({
        targetUserId,
        reason: reason.trim(),
        durationMinutes,
      }),
    onSuccess: (res) => {
      setIssued(res);
      setTargetUserId("");
      setReason("");
      setDurationMinutes(DEFAULT_DURATION);
      toast.success(t("impersonation.toast.startOk"));
      qc.invalidateQueries({ queryKey: ["impersonation", "active"] });
    },
    onError: () => toast.error(t("impersonation.toast.startErr")),
  });

  const endMut = useMutation({
    mutationFn: (sessionId: string) => impersonationService.end(sessionId),
    onSuccess: () => {
      toast.success(t("impersonation.toast.endOk"));
      qc.invalidateQueries({ queryKey: ["impersonation", "active"] });
    },
    onError: () => toast.error(t("impersonation.toast.endErr")),
  });

  function handleStart() {
    if (!targetUserId) {
      toast.error(t("impersonation.toast.pickTarget"));
      return;
    }
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON) {
      toast.error(t("impersonation.toast.reasonShort"));
      return;
    }
    if (trimmed.length > MAX_REASON) {
      toast.error(t("impersonation.toast.reasonLong"));
      return;
    }
    if (durationMinutes < MIN_DURATION || durationMinutes > MAX_DURATION) {
      toast.error(t("impersonation.toast.durationRange"));
      return;
    }
    startMut.mutate();
  }

  async function copyToken() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("impersonation.toast.copyErr"));
    }
  }

  const dtFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });

  const canStartImpersonation = actorRole === "OWNER" || actorRole === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("common.back")}
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Eye className="w-6 h-6 text-primary" />
          {t("impersonation.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("impersonation.subtitle")}
        </p>
      </div>

      {!canStartImpersonation && (
        <Card className="border-amber-500/40">
          <CardContent className="pt-6 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm">{t("impersonation.notAllowed")}</p>
          </CardContent>
        </Card>
      )}

      {issued && (
        <Card className="border-amber-500/60 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              {t("impersonation.tokenBanner.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              {t("impersonation.tokenBanner.showOnce")}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-background border rounded font-mono text-xs break-all">
                {issued.token}
              </code>
              <Button size="sm" variant="outline" onClick={copyToken}>
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">
                  {t("impersonation.target")}:
                </span>{" "}
                {issued.targetUserName ?? issued.targetUserEmail}
              </div>
              <div>
                <span className="font-medium text-foreground">
                  {t("impersonation.expiresAt")}:
                </span>{" "}
                {dtFmt.format(new Date(issued.expiresAt))}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIssued(null)}
              className="mt-2"
            >
              <X className="w-4 h-4 mr-1" />
              {t("common.dismiss")}
            </Button>
          </CardContent>
        </Card>
      )}

      {canStartImpersonation && (
        <Card>
          <CardHeader>
            <CardTitle>{t("impersonation.newSession")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">
                {t("impersonation.target")}
              </label>
              <select
                className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                disabled={loadingUsers || startMut.isPending}
              >
                <option value="">{t("impersonation.pickTarget")}</option>
                {eligibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name ?? u.email) + " · " + u.role}
                  </option>
                ))}
              </select>
              {eligibleUsers.length === 0 && !loadingUsers && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("impersonation.noEligible")}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">
                {t("impersonation.reason")}
              </label>
              <textarea
                className="w-full border rounded-md px-3 py-2 bg-background text-sm min-h-[80px]"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("impersonation.reasonPh")}
                maxLength={MAX_REASON}
                disabled={startMut.isPending}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {reason.trim().length}/{MAX_REASON} ·{" "}
                {t("impersonation.reasonHint", { min: String(MIN_REASON) })}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">
                {t("impersonation.durationMinutes")}
              </label>
              <input
                type="number"
                min={MIN_DURATION}
                max={MAX_DURATION}
                step={5}
                className="w-32 border rounded-md px-3 py-2 bg-background text-sm"
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(Number(e.target.value) || DEFAULT_DURATION)
                }
                disabled={startMut.isPending}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("impersonation.durationHint", {
                  min: String(MIN_DURATION),
                  max: String(MAX_DURATION),
                })}
              </p>
            </div>

            <Button
              onClick={handleStart}
              disabled={
                startMut.isPending || !targetUserId || reason.trim().length < MIN_REASON
              }
            >
              {startMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              {t("impersonation.start")}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {t("impersonation.activeSessions")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSessions ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : activeSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("impersonation.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {activeSessions.map((s: ImpersonationSession) => {
                const expires = new Date(s.expiresAt);
                const expired = expires.getTime() < Date.now();
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 border rounded-md gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {t("impersonation.target")}:{" "}
                        <code className="text-xs bg-muted px-1 rounded">
                          {s.targetUserId}
                        </code>
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {s.reason}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("impersonation.startedAt")}:{" "}
                        {dtFmt.format(new Date(s.createdAt))} ·{" "}
                        {t("impersonation.expiresAt")}:{" "}
                        <span className={expired ? "text-red-500" : ""}>
                          {dtFmt.format(expires)}
                        </span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => endMut.mutate(s.id)}
                      disabled={endMut.isPending}
                    >
                      <X className="w-4 h-4 mr-1" />
                      {t("impersonation.end")}
                    </Button>
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
