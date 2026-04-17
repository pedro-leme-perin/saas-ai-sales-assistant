"use client";

import { SegmentError } from "@/components/dashboard/segment-error";

export default function BillingError({
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
      segment="billing"
      title="Erro ao carregar faturamento"
      description="Não foi possível carregar os dados de faturamento. Tente novamente."
    />
  );
}
