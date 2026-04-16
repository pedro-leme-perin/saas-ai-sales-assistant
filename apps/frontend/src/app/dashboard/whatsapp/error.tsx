'use client';

import { SegmentError } from '@/components/dashboard/segment-error';

export default function WhatsAppError({
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
      segment="whatsapp"
      title="Erro ao carregar WhatsApp"
      description="Não foi possível carregar os dados do WhatsApp. Tente novamente."
    />
  );
}
