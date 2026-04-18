// =============================================
// 💸 PaymentRecoveryBanner (Session 42)
// =============================================
// Surfaces failed payments to prevent surprise suspension.
// Shows only when hasFailedPayments === true.
// =============================================

'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { billingService } from '@/services/api';
import { useTranslation } from '@/i18n/use-translation';

export function PaymentRecoveryBanner() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'recovery-status'],
    queryFn: () => billingService.getRecoveryStatus(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  if (isLoading || !data || !data.hasFailedPayments) return null;

  const latestInvoice = data.openInvoices[0];
  const deadline = latestInvoice?.graceDeadline
    ? new Date(latestInvoice.graceDeadline).toLocaleDateString('pt-BR')
    : null;

  const severity = data.inGracePeriod ? 'warning' : 'danger';
  const bgClass =
    severity === 'danger'
      ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40'
      : 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40';
  const iconClass = severity === 'danger' ? 'text-red-600' : 'text-amber-600';
  const textClass = severity === 'danger' ? 'text-red-900 dark:text-red-100' : 'text-amber-900 dark:text-amber-100';

  return (
    <div
      role="alert"
      className={`rounded-xl border p-4 flex items-start gap-3 ${bgClass}`}
    >
      <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconClass}`} />
      <div className="flex-1 min-w-0">
        <h3 className={`text-sm font-semibold ${textClass}`}>
          {severity === 'danger'
            ? t('billing.recovery.dangerTitle')
            : t('billing.recovery.warningTitle')}
        </h3>
        <p className={`text-sm mt-1 ${textClass} opacity-90`}>
          {deadline
            ? t('billing.recovery.gracePeriodMessage').replace('{{deadline}}', deadline)
            : t('billing.recovery.overdueMessage')}
        </p>
        {latestInvoice?.hostedInvoiceUrl && (
          <a
            href={latestInvoice.hostedInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 mt-2 text-sm font-medium ${textClass} hover:underline`}
          >
            {t('billing.recovery.payNow')}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
