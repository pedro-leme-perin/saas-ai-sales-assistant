// =============================================
// 🚀 OnboardingChecklist (Session 42)
// =============================================
// Interactive post-signup checklist. Dismissible, collapsible,
// navigates to actionUrl on click. Auto-hides when complete or dismissed.
// =============================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, X, ChevronDown, ChevronUp, Clock, SkipForward } from 'lucide-react';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import type { OnboardingStepId } from '@/services/api';
import { useTranslation } from '@/i18n/use-translation';

export function OnboardingChecklist() {
  const { t } = useTranslation();
  const { progress, isLoading, completeStep, skipStep, dismiss, isMutating } =
    useOnboardingProgress();
  const [collapsed, setCollapsed] = useState(false);

  if (isLoading || !progress) return null;
  if (progress.isDismissed || progress.isComplete) return null;

  return (
    <section
      aria-label={t('onboarding.checklist.title')}
      className="mb-6 rounded-xl border border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/40 dark:to-gray-950 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('onboarding.checklist.title')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('onboarding.checklist.subtitle')
              .replace(
                '{{completed}}',
                String(progress.stepsCompleted.length + progress.stepsSkipped.length),
              )
              .replace('{{total}}', String(progress.steps.length))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {progress.percent}%
          </span>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? t('common.expand') : t('common.collapse')}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => dismiss(undefined)}
            disabled={isMutating}
            aria-label={t('onboarding.checklist.dismiss')}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-200 dark:bg-gray-800">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      {/* Steps */}
      {!collapsed && (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {progress.steps.map((step) => (
            <li key={step.id} className="px-5 py-3 flex items-start gap-3 group">
              <button
                type="button"
                disabled={isMutating || step.status === 'completed'}
                onClick={() => completeStep(step.id)}
                aria-label={
                  step.status === 'completed'
                    ? t('onboarding.checklist.alreadyCompleted')
                    : t('onboarding.checklist.markComplete')
                }
                className="flex-shrink-0 mt-0.5 text-gray-400 hover:text-blue-600 disabled:cursor-default"
              >
                {step.status === 'completed' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
                ) : step.status === 'skipped' ? (
                  <SkipForward className="h-5 w-5 text-gray-400" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <Link
                  href={step.actionUrl}
                  className={`text-sm font-medium block ${
                    step.status === 'completed'
                      ? 'text-gray-400 line-through'
                      : step.status === 'skipped'
                        ? 'text-gray-500 italic'
                        : 'text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  {t(`onboarding.checklist.steps.${step.id}.title`)}
                </Link>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
                  {t(`onboarding.checklist.steps.${step.id}.description`)}
                  <span className="inline-flex items-center gap-1 text-gray-400">
                    <Clock className="h-3 w-3" />~{step.estimatedMinutes}min
                  </span>
                </p>
              </div>
              {step.status === 'pending' && (
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => skipStep({ stepId: step.id as OnboardingStepId })}
                  className="text-xs text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={t('onboarding.checklist.skip')}
                >
                  {t('onboarding.checklist.skip')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
