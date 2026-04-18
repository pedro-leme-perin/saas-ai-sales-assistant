// =============================================
// 🚀 useOnboardingProgress Hook (Session 42)
// =============================================

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  onboardingService,
  type OnboardingProgress,
  type OnboardingStepId,
} from '@/services/api';

const QUERY_KEY = ['onboarding', 'progress'] as const;

export function useOnboardingProgress() {
  const queryClient = useQueryClient();

  const query = useQuery<OnboardingProgress>({
    queryKey: QUERY_KEY,
    queryFn: () => onboardingService.getProgress(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const completeMutation = useMutation({
    mutationFn: (stepId: OnboardingStepId) => onboardingService.completeStep(stepId),
    onSuccess: (data) => queryClient.setQueryData(QUERY_KEY, data),
  });

  const skipMutation = useMutation({
    mutationFn: ({ stepId, reason }: { stepId: OnboardingStepId; reason?: string }) =>
      onboardingService.skipStep(stepId, reason),
    onSuccess: (data) => queryClient.setQueryData(QUERY_KEY, data),
  });

  const dismissMutation = useMutation({
    mutationFn: (feedback?: string) => onboardingService.dismiss(feedback),
    onSuccess: (data) => queryClient.setQueryData(QUERY_KEY, data),
  });

  const resetMutation = useMutation({
    mutationFn: () => onboardingService.reset(),
    onSuccess: (data) => queryClient.setQueryData(QUERY_KEY, data),
  });

  return {
    progress: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    completeStep: completeMutation.mutate,
    skipStep: skipMutation.mutate,
    dismiss: dismissMutation.mutate,
    reset: resetMutation.mutate,
    isMutating:
      completeMutation.isPending ||
      skipMutation.isPending ||
      dismissMutation.isPending ||
      resetMutation.isPending,
  };
}
