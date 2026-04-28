'use client';

// =============================================
// CSAT Trends error boundary (Session 59)
// =============================================

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/use-translation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    // Sentry boundary captures automatically at higher level; log for local.
    console.error('csat/trends error', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <h2 className="text-lg font-semibold">{t('csatTrends.error')}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={() => reset()}>{t('common.retry')}</Button>
    </div>
  );
}
