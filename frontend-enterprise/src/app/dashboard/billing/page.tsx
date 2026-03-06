'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useBilling } from '@/hooks/useBilling';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  CreditCard, CheckCircle, XCircle, AlertCircle,
  FileText, Zap, Building2, Rocket, ExternalLink,
  Loader2, RefreshCw, Users, Phone, MessageSquare,
} from 'lucide-react';

const PLAN_ICONS: Record<string, React.ReactNode> = {
  STARTER:      <Zap className="w-6 h-6" />,
  PROFESSIONAL: <Rocket className="w-6 h-6" />,
  ENTERPRISE:   <Building2 className="w-6 h-6" />,
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE:   { label: 'Ativo',      color: 'text-green-700 bg-green-100' },
  active:   { label: 'Ativo',      color: 'text-green-700 bg-green-100' },
  trialing: { label: 'Trial',      color: 'text-blue-700 bg-blue-100' },
  canceled: { label: 'Cancelado',  color: 'text-red-700 bg-red-100' },
  past_due: { label: 'Em atraso',  color: 'text-orange-700 bg-orange-100' },
};

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  paid:          { label: 'Pago',       color: 'text-green-700 bg-green-100' },
  PAID:          { label: 'Pago',       color: 'text-green-700 bg-green-100' },
  open:          { label: 'Pendente',   color: 'text-yellow-700 bg-yellow-100' },
  void:          { label: 'Cancelado',  color: 'text-gray-700 bg-gray-100' },
  uncollectible: { label: 'Incobrável', color: 'text-red-700 bg-red-100' },
};

export default function BillingPage() {
  const {
    subscription, plans, invoices, loading, error, currentPlan,
    startCheckout, openPortal, cancelSubscription, changePlan, reload,
  } = useBilling();

  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<'success' | 'canceled' | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('success') === 'true')   setBanner('success');
    if (searchParams.get('canceled') === 'true')  setBanner('canceled');
  }, [searchParams]);

  const handleAction = async (key: string, fn: () => Promise<void>) => {
    setActionLoading(key);
    try { await fn(); }
    catch (e: any) { alert(`Erro: ${e.message}`); }
    finally { setActionLoading(null); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-800">Erro ao carregar cobrança</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
        </div>
        <button onClick={reload} className="ml-auto text-red-600 hover:text-red-800">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const activeSub = subscription?.subscription;
  const company   = subscription?.company;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      {/* Banners */}
      {banner === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span className="text-sm font-medium text-green-800">
            Assinatura ativada com sucesso!
          </span>
          <button onClick={() => setBanner(null)} className="ml-auto text-green-600 text-xl leading-none">×</button>
        </div>
      )}
      {banner === 'canceled' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <span className="text-sm font-medium text-yellow-800">
            Checkout cancelado. Nenhuma cobrança realizada.
          </span>
          <button onClick={() => setBanner(null)} className="ml-auto text-yellow-600 text-xl leading-none">×</button>
        </div>
      )}

      {/* Assinatura atual */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Assinatura Atual</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                {PLAN_ICONS[currentPlan] || <CreditCard className="w-6 h-6" />}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-lg capitalize">
                  {currentPlan.charAt(0) + currentPlan.slice(1).toLowerCase()}
                </p>
                {activeSub ? (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      STATUS_CONFIG[activeSub.status]?.color || 'text-gray-600 bg-gray-100'
                    }`}>
                      {STATUS_CONFIG[activeSub.status]?.label || activeSub.status}
                    </span>
                    {activeSub.currentPeriodEnd && (
                      <span className="text-xs text-gray-500">
                        Renova em {formatDate(activeSub.currentPeriodEnd)}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">Plano gratuito</p>
                )}
              </div>
            </div>

            {/* Limites */}
            {company?.limits && (
              <div className="flex gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {company.limits.users === 1000 ? '∞' : company.limits.users} usuários
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {company.limits.callsPerMonth === 10000 ? '∞' : company.limits.callsPerMonth} ligações
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {company.limits.chatsPerMonth === 10000 ? '∞' : company.limits.chatsPerMonth} chats
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {activeSub && (
                <button
                  onClick={() => handleAction('portal', openPortal)}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {actionLoading === 'portal' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Gerenciar
                </button>
              )}
              {activeSub?.status === 'active' && (
                <button
                  onClick={() => {
                    if (confirm('Cancelar assinatura? O acesso permanece até o fim do período.'))
                      handleAction('cancel', cancelSubscription);
                  }}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  {actionLoading === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Planos */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Planos Disponíveis</h2>
        {plans.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-400 text-sm">
            Planos não disponíveis.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrent  = plan.plan === currentPlan;
              const isLoading  = actionLoading === plan.plan;
              const hasStripe  = !!activeSub;

              return (
                <div
                  key={plan.plan}
                  className={`relative bg-white border rounded-xl p-6 flex flex-col gap-4 transition-shadow hover:shadow-md ${
                    plan.isPopular ? 'border-indigo-400 ring-2 ring-indigo-400' : 'border-gray-200'
                  }`}
                >
                  {plan.isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                      Mais popular
                    </span>
                  )}

                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${plan.isPopular ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}>
                      {PLAN_ICONS[plan.plan] || <CreditCard className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{plan.name}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-0.5">
                        {formatCurrency(plan.price)}
                        <span className="text-sm font-normal text-gray-500">/mês</span>
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-1.5 flex-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="w-full py-2 text-center text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg">
                      Plano atual
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (hasStripe) {
                          if (confirm(`Mudar para o plano ${plan.name}?`))
                            handleAction(plan.plan, () => changePlan(plan.plan));
                        } else {
                          handleAction(plan.plan, () => startCheckout(plan.plan));
                        }
                      }}
                      disabled={!!actionLoading}
                      className={`w-full py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-colors ${
                        plan.isPopular
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {hasStripe ? 'Mudar plano' : 'Fazer upgrade'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Faturas */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Histórico de Faturas</h2>
        {invoices.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-400 text-sm">
            Nenhuma fatura encontrada.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => {
                  const st = INVOICE_STATUS[inv.status] || { label: inv.status, color: 'text-gray-600 bg-gray-100' };
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{formatDate(inv.createdAt)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {formatCurrency((inv.amount || 0) / 100)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {inv.pdfUrl ? (
                          <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800">
                            <FileText className="w-4 h-4" /> Baixar
                          </a>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}