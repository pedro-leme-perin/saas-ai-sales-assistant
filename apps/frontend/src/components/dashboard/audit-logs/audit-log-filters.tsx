"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/use-translation";

export interface AuditFilters {
  action?: string;
  resource?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface AuditLogFiltersProps {
  filters: AuditFilters;
  onChange: (filters: AuditFilters) => void;
}

const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "EXPORT",
  "IMPORT",
  "INVITE",
  "REVOKE",
] as const;

export function AuditLogFilters({ filters, onChange }: AuditLogFiltersProps) {
  const { t } = useTranslation();

  const hasActiveFilters =
    filters.action ||
    filters.resource ||
    filters.userId ||
    filters.dateFrom ||
    filters.dateTo;

  const handleClear = () => {
    onChange({
      action: undefined,
      resource: undefined,
      userId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
  };

  const updateFilter = (key: keyof AuditFilters, value: string) => {
    onChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Action dropdown */}
      <div className="flex-1 min-w-[160px]">
        <label
          htmlFor="filter-action"
          className="text-sm font-medium text-muted-foreground mb-1.5 block"
        >
          {t("auditLogs.filters.action")}
        </label>
        <select
          id="filter-action"
          value={filters.action || ""}
          onChange={(e) => updateFilter("action", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">{t("auditLogs.filters.allActions")}</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {t(`auditLogs.actions.${action}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Resource input */}
      <div className="flex-1 min-w-[160px]">
        <label
          htmlFor="filter-resource"
          className="text-sm font-medium text-muted-foreground mb-1.5 block"
        >
          {t("auditLogs.filters.resource")}
        </label>
        <input
          id="filter-resource"
          type="text"
          placeholder={t("auditLogs.filters.resourcePlaceholder")}
          value={filters.resource || ""}
          onChange={(e) => updateFilter("resource", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Date from */}
      <div className="flex-1 min-w-[150px]">
        <label
          htmlFor="filter-date-from"
          className="text-sm font-medium text-muted-foreground mb-1.5 block"
        >
          {t("auditLogs.filters.startDate")}
        </label>
        <input
          id="filter-date-from"
          type="date"
          value={filters.dateFrom || ""}
          onChange={(e) => updateFilter("dateFrom", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Date to */}
      <div className="flex-1 min-w-[150px]">
        <label
          htmlFor="filter-date-to"
          className="text-sm font-medium text-muted-foreground mb-1.5 block"
        >
          {t("auditLogs.filters.endDate")}
        </label>
        <input
          id="filter-date-to"
          type="date"
          value={filters.dateTo || ""}
          onChange={(e) => updateFilter("dateTo", e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Clear button */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="default"
          onClick={handleClear}
          className="gap-1.5 flex-shrink-0"
        >
          <X className="h-3.5 w-3.5" />
          {t("auditLogs.filters.reset")}
        </Button>
      )}
    </div>
  );
}
