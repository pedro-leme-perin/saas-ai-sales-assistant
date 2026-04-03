'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/use-translation';
import { companiesService } from '@/services/api';
import { useUserStore } from '@/stores';

interface OnboardingData {
  companyName: string;
  teamSize: string;
  industry: string;
  channels: string[];
  selectedPlan: string;
}

const TEAM_SIZES = ['1-5', '6-20', '21-50', '50+'];
const INDUSTRIES = ['sales', 'realEstate', 'insurance', 'saas', 'other'];
const CHANNELS = ['phone', 'whatsapp'];
const PLANS = [
  { id: 'STARTER', price: 0, highlight: false },
  { id: 'PROFESSIONAL', price: 297, highlight: true },
  { id: 'ENTERPRISE', price: 697, highlight: false },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { company } = useUserStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    companyName: company?.name || '',
    teamSize: '',
    industry: '',
    channels: [],
    selectedPlan: 'STARTER',
  });

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;

  function toggleChannel(ch: string) {
    setData((prev) => ({
      ...prev,
      channels: prev.channels.includes(ch)
        ? prev.channels.filter((c) => c !== ch)
        : [...prev.channels, ch],
    }));
  }

  function canProceed(): boolean {
    if (step === 0) return data.companyName.trim().length >= 2;
    if (step === 1) return !!data.teamSize && !!data.industry;
    if (step === 2) return data.channels.length > 0;
    return true;
  }

  async function handleFinish() {
    setSaving(true);
    try {
      await companiesService.completeOnboarding({
        companyName: data.companyName.trim(),
        teamSize: data.teamSize,
        industry: data.industry,
        channels: data.channels,
        selectedPlan: data.selectedPlan,
      });
      toast.success(t('onboarding.success'));
      router.push('/dashboard');
    } catch {
      toast.error(t('onboarding.error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
            <span>{t('onboarding.stepOf').replace('{{current}}', String(step + 1)).replace('{{total}}', String(totalSteps))}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t('onboarding.welcome.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('onboarding.welcome.subtitle')}
            </p>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('onboarding.welcome.companyLabel')}
            </label>
            <input
              type="text"
              value={data.companyName}
              onChange={(e) => setData({ ...data, companyName: e.target.value })}
              placeholder={t('onboarding.welcome.companyPlaceholder')}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Step 1: Team & Industry */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t('onboarding.team.title')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('onboarding.team.subtitle')}
            </p>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('onboarding.team.sizeLabel')}
            </label>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {TEAM_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setData({ ...data, teamSize: size })}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                    data.teamSize === size
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                  }`}
                >
                  {size} {t('onboarding.team.people')}
                </button>
              ))}
            </div>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('onboarding.team.industryLabel')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind}
                  onClick={() => setData({ ...data, industry: ind })}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                    data.industry === ind
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                  }`}
                >
                  {t(`onboarding.team.industries.${ind}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Channels */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t('onboarding.channels.title')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('onboarding.channels.subtitle')}
            </p>
            <div className="space-y-4">
              {CHANNELS.map((ch) => (
                <button
                  key={ch}
                  onClick={() => toggleChannel(ch)}
                  className={`w-full p-5 rounded-lg border text-left transition-all ${
                    data.channels.includes(ch)
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {t(`onboarding.channels.${ch}.name`)}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t(`onboarding.channels.${ch}.desc`)}
                      </p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      data.channels.includes(ch)
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {data.channels.includes(ch) && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Plan */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t('onboarding.plan.title')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('onboarding.plan.subtitle')}
            </p>
            <div className="space-y-4">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setData({ ...data, selectedPlan: plan.id })}
                  className={`w-full p-5 rounded-lg border text-left transition-all ${
                    data.selectedPlan === plan.id
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  } ${plan.highlight ? 'ring-2 ring-blue-200 dark:ring-blue-800' : ''}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {t(`onboarding.plan.plans.${plan.id}.name`)}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t(`onboarding.plan.plans.${plan.id}.desc`)}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {plan.price === 0
                        ? t(`onboarding.plan.plans.${plan.id}.price`)
                        : `R$${plan.price}/mo`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('onboarding.back')}
          </button>

          {step < totalSteps - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t('onboarding.next')}
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              {saving ? t('common.loading') : t('onboarding.finish')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
