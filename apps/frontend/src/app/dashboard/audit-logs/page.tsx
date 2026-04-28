'use client';

import { useState, useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Trash2,
  Edit,
  LogIn,
  LogOut,
  Download,
  Upload,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { analyticsService, authService } from '@/services/api';
import { formatDateTime } from '@/lib/utils';
import { useTranslation } from '@/i18n/use-translation';

type AuditAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'IMPORT'
  | 'INVITE'
  | 'REVOKE';

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

const actionIcons: Record<AuditAction, React.ComponentType<{ className?: string }>> = {
  CREATE: Plus,
  READ: FileText,
  UPDATE: Edit,
  DELETE: Trash2,
  LOGIN: LogIn,
  LOGOUT: LogOut,
  EXPORT: Download,
  IMPORT: Upload,
  INVITE: UserPlus,
  REVOKE: XCircle,
};

const actionColors: Record<AuditAction, string> = {
  CREATE: 'bg-green-50 text-green-700 border-green-200',
  READ: 'bg-blue-50 text-blue-700 border-blue-200',
  UPDATE: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
  LOGIN: 'bg-purple-50 text-purple-700 border-purple-200',
  LOGOUT: 'bg-gray-50 text-gray-700 border-gray-200',
  EXPORT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  IMPORT: 'bg-orange-50 text-orange-700 border-orange-200',
  INVITE: 'bg-teal-50 text-teal-700 border-teal-200',
  REVOKE: 'bg-red-50 text-red-700 border-red-200',
};

function AuditLogsSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-lg border animate-pulse">
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 bg-muted rounded" />
            <div className="h-3 w-64 bg-muted rounded" />
          </div>
          <div className="h-4 w-40 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

const AuditLogRow = memo(function AuditLogRow({
  log,
  t,
}: {
  log: AuditLog;
  t: (key: string) => string;
}) {
  const ActionIcon = actionIcons[log.action];

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors group">
      <div className="flex items-center gap-4 flex-1">
        <div className={`p-2 rounded-lg border ${actionColors[log.action]}`}>
          <ActionIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${actionColors[log.action]}`}
            >
              {t(`auditLogs.actions.${log.action}`)}
            </span>
            <p className="font-medium text-sm">
              {log.resource} {log.resourceId ? `(${log.resourceId})` : ''}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-0.5 flex-wrap">
            {log.user && (
              <span>
                {log.user.name} ({log.user.email})
              </span>
            )}
            {log.description && <span>{log.description}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <span className="text-xs text-muted-foreground hidden sm:block whitespace-nowrap">
          {formatDateTime(new Date(log.createdAt))}
        </span>
      </div>
    </div>
  );
});

export default function AuditLogsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [action, setAction] = useState<string>('');
  const [resource, setResource] = useState<string>('');
  const [searchUser, setSearchUser] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', page, limit, action, resource, searchUser, dateRange],
    queryFn: async () => {
      const res = await analyticsService.getAuditLogs({
        page,
        limit,
        action: action || undefined,
        resource: resource || undefined,
        userId: searchUser || undefined,
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined,
      });
      return res as {
        data: AuditLog[];
        meta: { total: number; totalPages: number };
      };
    },
  });

  const uniqueActions = useMemo(
    () =>
      Array.from(
        new Set([
          'CREATE',
          'READ',
          'UPDATE',
          'DELETE',
          'LOGIN',
          'LOGOUT',
          'EXPORT',
          'IMPORT',
          'INVITE',
          'REVOKE',
        ]),
      ),
    [],
  );

  const handleReset = () => {
    setPage(1);
    setAction('');
    setResource('');
    setSearchUser('');
    setDateRange({ start: '', end: '' });
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);
    try {
      const blob = await analyticsService.exportAuditLogs({
        format,
        action: action || undefined,
        resource: resource || undefined,
        userId: searchUser || undefined,
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('audit log export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  const isFiltered = action || resource || searchUser || dateRange.start || dateRange.end;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            {t('auditLogs.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('auditLogs.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleExport('csv')} disabled={isExporting}>
            <Download className="h-4 w-4 mr-2" />
            {t('auditLogs.export.csv')}
          </Button>
          <Button variant="outline" onClick={() => handleExport('json')} disabled={isExporting}>
            <Download className="h-4 w-4 mr-2" />
            {t('auditLogs.export.json')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('auditLogs.filters.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Action filter */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {t('auditLogs.filters.action')}
              </label>
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">{t('auditLogs.filters.allActions')}</option>
                {uniqueActions.map((act) => (
                  <option key={act} value={act}>
                    {t(`auditLogs.actions.${act}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Resource filter */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {t('auditLogs.filters.resource')}
              </label>
              <input
                type="text"
                placeholder={t('auditLogs.filters.resourcePlaceholder')}
                value={resource}
                onChange={(e) => {
                  setResource(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* User search */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {t('auditLogs.filters.user')}
              </label>
              <input
                type="text"
                placeholder={t('auditLogs.filters.userPlaceholder')}
                value={searchUser}
                onChange={(e) => {
                  setSearchUser(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Start date */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {t('auditLogs.filters.startDate')}
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => {
                  setDateRange({ ...dateRange, start: e.target.value });
                  setPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* End date */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {t('auditLogs.filters.endDate')}
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => {
                  setDateRange({ ...dateRange, end: e.target.value });
                  setPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Reset button */}
            {isFiltered && (
              <div className="flex items-end">
                <Button variant="outline" onClick={handleReset} className="w-full">
                  {t('auditLogs.filters.reset')}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('auditLogs.logsList')} ({data?.meta?.total || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <AuditLogsSkeleton />
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 font-medium">{t('common.error')}</p>
              <p className="text-muted-foreground text-sm mt-1">{t('auditLogs.loadError')}</p>
            </div>
          ) : data?.data?.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto opacity-50 mb-4" />
              <p className="text-muted-foreground">{t('auditLogs.noResults')}</p>
            </div>
          ) : data?.data ? (
            <div className="space-y-2">
              {data.data.map((log: AuditLog) => (
                <AuditLogRow key={log.id} log={log} t={t} />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between py-4">
          <p className="text-sm text-muted-foreground">
            {t('auditLogs.pagination.showing')} {(page - 1) * limit + 1}{' '}
            {t('auditLogs.pagination.to')} {Math.min(page * limit, data.meta.total)}{' '}
            {t('auditLogs.pagination.of')} {data.meta.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label={t('accessibility.previousPage')}
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium" aria-live="polite">
              {page} / {data.meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('accessibility.nextPage')}
              onClick={() => setPage(Math.min(data.meta.totalPages, page + 1))}
              disabled={page === data.meta.totalPages}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
