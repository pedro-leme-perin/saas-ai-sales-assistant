"use client";

import { useEffect, useState } from "react";
import {
  X,
  Copy,
  Check,
  Clock,
  User,
  Globe,
  Monitor,
  Hash,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";
import { formatDateTime } from "@/lib/utils";

type AuditAction =
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "EXPORT"
  | "IMPORT"
  | "INVITE"
  | "REVOKE";

interface AuditLog {
  id: string;
  companyId: string;
  userId: string | null;
  action: AuditAction;
  resource: string;
  resourceId: string | null;
  description: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface AuditLogDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: AuditLog | null;
}

const actionColors: Record<AuditAction, string> = {
  CREATE:
    "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
  READ: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  UPDATE:
    "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700",
  DELETE:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
  LOGIN:
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700",
  LOGOUT:
    "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-600",
  EXPORT:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700",
  IMPORT:
    "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700",
  INVITE:
    "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700",
  REVOKE:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
};

function JsonDiffView({
  oldValues,
  newValues,
  t,
}: {
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  t: (key: string) => string;
}) {
  if (!oldValues && !newValues) return null;

  const allKeys = Array.from(
    new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})]),
  ).sort();

  if (allKeys.length === 0) {
    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">
          {t("auditLogs.detail.changes")}
        </h4>
        <p className="text-sm text-muted-foreground italic">
          {t("auditLogs.detail.noChanges")}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium mb-2">
        {t("auditLogs.detail.changes")}
      </h4>
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        {/* Headers */}
        <div className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-t-lg font-sans font-medium">
          {t("auditLogs.detail.oldValues")}
        </div>
        <div className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-t-lg font-sans font-medium">
          {t("auditLogs.detail.newValues")}
        </div>

        {/* Rows */}
        {allKeys.map((key) => {
          const oldVal = oldValues?.[key];
          const newVal = newValues?.[key];
          const hasChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

          return (
            <div key={key} className="contents">
              <div
                className={`px-3 py-1.5 border-l-2 ${
                  hasChanged
                    ? "border-red-400 bg-red-50/50 dark:bg-red-900/10"
                    : "border-transparent bg-muted/30"
                }`}
              >
                <span className="text-muted-foreground">{key}: </span>
                {oldVal !== undefined ? (
                  <span
                    className={
                      hasChanged ? "text-red-600 dark:text-red-400" : ""
                    }
                  >
                    {JSON.stringify(oldVal)}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">--</span>
                )}
              </div>
              <div
                className={`px-3 py-1.5 border-l-2 ${
                  hasChanged
                    ? "border-green-400 bg-green-50/50 dark:bg-green-900/10"
                    : "border-transparent bg-muted/30"
                }`}
              >
                <span className="text-muted-foreground">{key}: </span>
                {newVal !== undefined ? (
                  <span
                    className={
                      hasChanged ? "text-green-600 dark:text-green-400" : ""
                    }
                  >
                    {JSON.stringify(newVal)}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">--</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AuditLogDetailModal({
  isOpen,
  onClose,
  log,
}: AuditLogDetailModalProps) {
  const { t } = useTranslation();
  const [copiedRequestId, setCopiedRequestId] = useState(false);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Reset copy state when modal closes
  useEffect(() => {
    if (!isOpen) setCopiedRequestId(false);
  }, [isOpen]);

  const handleCopyRequestId = async () => {
    if (!log?.requestId) return;
    try {
      await navigator.clipboard.writeText(log.requestId);
      setCopiedRequestId(true);
      setTimeout(() => setCopiedRequestId(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  if (!isOpen || !log) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-detail-title"
        className="bg-background rounded-xl shadow-2xl w-full max-w-lg m-4 max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-background rounded-t-xl z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 id="audit-detail-title" className="text-lg font-semibold">
                {t("auditLogs.detail.title")}
              </h2>
              <span
                className={`inline-flex text-xs px-2 py-0.5 rounded-full border font-medium ${actionColors[log.action]}`}
              >
                {t(`auditLogs.actions.${log.action}`)}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Resource */}
          <div className="flex items-start gap-3">
            <Hash className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {t("auditLogs.detail.resource")}
              </p>
              <p className="text-sm text-muted-foreground">
                {log.resource}
                {log.resourceId && (
                  <span className="ml-1 font-mono text-xs">
                    ({log.resourceId})
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Timestamp */}
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {t("auditLogs.detail.timestamp")}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(new Date(log.createdAt))}
              </p>
            </div>
          </div>

          {/* User */}
          {log.user && (
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  {t("auditLogs.detail.user")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {log.user.name}
                  <span className="ml-1 text-xs">({log.user.email})</span>
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          {log.description && (
            <div className="flex items-start gap-3">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  {t("auditLogs.detail.description")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {log.description}
                </p>
              </div>
            </div>
          )}

          {/* IP Address */}
          {log.ipAddress && (
            <div className="flex items-start gap-3">
              <Globe className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  {t("auditLogs.detail.ipAddress")}
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                  {log.ipAddress}
                </p>
              </div>
            </div>
          )}

          {/* User Agent */}
          {log.userAgent && (
            <div className="flex items-start gap-3">
              <Monitor className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  {t("auditLogs.detail.userAgent")}
                </p>
                <p className="text-sm text-muted-foreground text-xs break-all">
                  {log.userAgent}
                </p>
              </div>
            </div>
          )}

          {/* Request ID */}
          {log.requestId && (
            <div className="flex items-start gap-3">
              <Hash className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {t("auditLogs.detail.requestId")}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all">
                    {log.requestId}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    aria-label={t("auditLogs.detail.copyRequestId")}
                    onClick={handleCopyRequestId}
                  >
                    {copiedRequestId ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                {copiedRequestId && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {t("auditLogs.detail.copied")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* JSON Diff View */}
          <JsonDiffView
            oldValues={log.oldValues}
            newValues={log.newValues}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}
