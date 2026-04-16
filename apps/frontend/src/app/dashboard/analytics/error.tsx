'use client';

import { SegmentError } from '@/components/dashboard/segment-error';

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SegmentError
      error={error}
      reset={reset}
      segment="analytics"
      title="Erro ao carregar analytics"
      description="Não foi possível carregar os dados de analytics. Tente novamente."
    />
  );
}
