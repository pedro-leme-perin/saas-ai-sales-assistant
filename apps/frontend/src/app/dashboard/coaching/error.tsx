"use client";

import { SegmentError } from "@/components/dashboard/segment-error";

export default function CoachingError({
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
      segment="coaching"
      title="Erro ao carregar coaching"
      description="Não foi possível carregar seus relatórios semanais. Tente novamente."
    />
  );
}
