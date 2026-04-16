'use client';

import { SegmentError } from '@/components/dashboard/segment-error';

export default function AuditLogsError({
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
      segment="audit-logs"
      title="Erro ao carregar logs de auditoria"
      description="Não foi possível carregar os logs de auditoria. Tente novamente."
    />
  );
}
