'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import {
  CreditCard,
  Check,
  Receipt,
  Download,
  ExternalLink,
  Sparkles,
  Users,
  Phone,
  MessageSquare,
  Crown,
  Zap,
  Building,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { billingService, companiesService } from '@/services/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plan } from '@/types';

const planIcons: Record<Plan, React.ElementType> = {
  STARTER: Zap,
  PROFESSIONAL: Crown,
  ENTERPRISE: Building,
};

const planColors: Record<Plan, string> = {
  STARTER: 'from-blue-500 to-cyan-500',
  PROFESSIONAL: 'from-violet-500 to-purple-500',
  ENTERPRISE: 'from-amber-500 to-orange-500',
};

export default function BillingPage() {
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => billingService.getSubscription(),
  });

  const { data: invoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => billingService.getInvoices(),
  });

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => billingService.getPlans(),
  });

  const { data: usage } = useQuery({
    queryKey: ['company-usage'],
    queryFn: () => companiesService.getUsage(),
  });

  const checkoutMutation = useMutation({
    mutationFn: (plan: string) => billingService.createCheckout(plan),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => billingService.getPortalUrl(),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => billingService.cancelSubscription(),
  });

  const currentPlan = usage?.plan || 'STARTER';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Faturamento</h1>
          <p className="text-muted-foreground">Gerencie sua assinatura e pagamentos.</p>
        </div>
        {subscription && (
          <Button variant="outline" onClick={() => portalMutation.mutate()}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Portal de Pagamentos
          </Button>
        )}
      </div>

      {/* Current Subscription */}
      <Card
        className={`bg-gradient-to-r ${planColors[currentPlan]} text-white overflow-hidden relative`}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <CardContent className="p-6 relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              {(() => {
                const PlanIcon = planIcons[currentPlan];
                return (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
                    <PlanIcon className="h-8 w-8" />
                  </div>
                );
              })()}
              <div>
                <p className="text-sm opacity-80">Plano Atual</p>
                <h2 className="text-2xl font-bold">
                  {currentPlan === 'STARTER'
                    ? 'Starter'
                    : currentPlan === 'PROFESSIONAL'
                    ? 'Professional'
                    : 'Enterprise'}
                </h2>
                {subscription && (
                  <p className="text-sm opacity-80">
                    Próxima cobrança em {formatDate(subscription.currentPeriodEnd)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="text-3xl font-bold">
                {currentPlan === 'STARTER'
                  ? 'R$ 149'
                  : currentPlan === 'PROFESSIONAL'
                  ? 'R$ 299'
                  : 'R$ 499'}
                <span className="text-lg font-normal opacity-80">/mês</span>
              </p>
              {subscription?.status === 'active' && (
                <span className="flex items-center gap-1 text-sm bg-white/20 px-3 py-1 rounded-full">
                  <Check className="h-4 w-4" />
                  Ativo
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      {usage && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Usuários</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usage.users.used} / {usage.users.limit}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${usage.users.percentage}%` }}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Ligações/mês</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usage.calls.used} / {usage.calls.limit === -1 ? '∞' : usage.calls.limit}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${Math.min(usage.calls.percentage, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Chats/mês</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usage.chats.used} / {usage.chats.limit === -1 ? '∞' : usage.chats.limit}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all"
                  style={{ width: `${Math.min(usage.chats.percentage, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Plans Comparison */}
      <div>
        <h2 className="text-xl font-bold mb-4">Planos Disponíveis</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans?.map((plan) => {
            const PlanIcon = planIcons[plan.plan];
            const isCurrentPlan = plan.plan === currentPlan;
            return (
              <Card
                key={plan.plan}
                className={isCurrentPlan ? 'border-primary ring-2 ring-primary/20' : ''}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r ${planColors[plan.plan]} text-white`}
                    >
                      <PlanIcon className="h-5 w-5" />
                    </div>
                    {isCurrentPlan && (
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                        Atual
                      </span>
                    )}
                  </div>
                  <CardTitle className="mt-4">{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-2xl font-bold text-foreground">
                      {formatCurrency(plan.price)}
                    </span>
                    <span className="text-muted-foreground">/mês</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? 'outline' : 'default'}
                    disabled={isCurrentPlan || checkoutMutation.isPending}
                    onClick={() => checkoutMutation.mutate(plan.plan)}
                  >
                    {isCurrentPlan ? 'Plano Atual' : 'Fazer Upgrade'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Faturas</CardTitle>
          <CardDescription>Últimas cobranças realizadas</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices && invoices.length > 0 ? (
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Receipt className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{formatCurrency(invoice.amount / 100)}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(invoice.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : invoice.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {invoice.status === 'paid'
                        ? 'Pago'
                        : invoice.status === 'pending'
                        ? 'Pendente'
                        : 'Falhou'}
                    </span>
                    {invoice.pdfUrl && (
                      <Button variant="ghost" size="icon-sm" asChild>
                        <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">Nenhuma fatura encontrada</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Subscription */}
      {subscription && subscription.status === 'active' && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Cancelar Assinatura</CardTitle>
            <CardDescription>
              Ao cancelar, você perderá acesso às funcionalidades premium no final do período atual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm('Tem certeza que deseja cancelar sua assinatura?')) {
                  cancelMutation.mutate();
                }
              }}
              disabled={cancelMutation.isPending}
            >
              Cancelar Assinatura
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
