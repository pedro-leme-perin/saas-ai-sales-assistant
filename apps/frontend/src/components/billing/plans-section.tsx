'use client';

import { useMemo } from 'react';
import { CreditCard, Loader2, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

const PLAN_ICONS: Record<string, React.ReactNode> = {
  STARTER: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>,
  PROFESSIONAL: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M13 7H7v6h6V7z" /><path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2V2a1 1 0 112 0v1a2 2 0 012 2v2h1a2 2 0 012 2v2h1a2 2 0 012 2v6a2 2 0 01-2 2h-1v1a1 1 0 11-2 0v-1h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H4a2 2 0 01-2-2v-6a2 2 0 012-2h1V7a2 2 0 012-2h1V2a1 1 0 010-2h2V2z" clipRule="evenodd" /></svg>,
  ENTERPRISE: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>,
};

interface PlansSectionProps {
  plans: Array<{
    plan: string;
    name: string;
    price: number;
    features: string[];
    isPopular?: boolean;
  }>;
  currentPlan: string;
  hasStripe: boolean;
  actionLoading: string | null;
  onAction: (key: string, fn: () => Promise<void>) => void;
  startCheckout: (plan: string) => Promise<void>;
  changePlan: (plan: string) => Promise<void>;
}

export default function PlansSection({
  plans,
  currentPlan,
  hasStripe,
  actionLoading,
  onAction,
  startCheckout,
  changePlan,
}: PlansSectionProps) {
  const planCards = useMemo(
    () =>
      plans.map((plan) => {
        const isCurrent = plan.plan === currentPlan;
        const isLoading = actionLoading === plan.plan;

        return (
          <Card
            key={plan.plan}
            className={`relative flex flex-col transition-shadow hover:shadow-md ${
              plan.isPopular ? 'border-primary ring-2 ring-primary' : ''
            }`}
          >
            {plan.isPopular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                Mais popular
              </span>
            )}

            <CardContent className="p-6 flex flex-col gap-4 flex-1">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    plan.isPopular
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {PLAN_ICONS[plan.plan] || <CreditCard className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-2xl font-bold mt-0.5">
                    {formatCurrency(plan.price)}
                    <span className="text-sm font-normal text-muted-foreground">
                      /mês
                    </span>
                  </p>
                </div>
              </div>

              <ul className="space-y-1.5 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="w-full py-2.5 text-center text-sm font-medium text-primary bg-primary/10 rounded-lg">
                  Plano atual
                </div>
              ) : (
                <Button
                  onClick={() => {
                    if (hasStripe) {
                      onAction(plan.plan, () => changePlan(plan.plan));
                    } else {
                      onAction(plan.plan, () => startCheckout(plan.plan));
                    }
                  }}
                  disabled={!!actionLoading}
                  variant={plan.isPopular ? 'default' : 'outline'}
                  className="w-full gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {hasStripe ? 'Mudar plano' : 'Fazer upgrade'}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      }),
    [plans, currentPlan, hasStripe, actionLoading, onAction, startCheckout, changePlan]
  );

  if (plans.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          Planos não disponíveis.
        </CardContent>
      </Card>
    );
  }

  return <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{planCards}</div>;
}
