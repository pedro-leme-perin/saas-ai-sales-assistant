"use client";

import { SegmentError } from "@/components/dashboard/segment-error";

export default function CallsError({
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
      segment="calls"
      title="Erro ao carregar ligações"
      description="Não foi possível carregar os dados de ligações. Tente novamente."
    />
  );
}
