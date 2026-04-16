'use client';

import { SegmentError } from '@/components/dashboard/segment-error';

export default function TeamError({
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
      segment="team"
      title="Erro ao carregar equipe"
      description="Não foi possível carregar os dados da equipe. Tente novamente."
    />
  );
}
