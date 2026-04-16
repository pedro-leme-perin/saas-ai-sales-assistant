'use client';

import { SegmentError } from '@/components/dashboard/segment-error';

export default function SettingsError({
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
      segment="settings"
      title="Erro ao carregar configurações"
      description="Não foi possível carregar as configurações. Tente novamente."
    />
  );
}
