"use client";
import { Suspense, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useBilling } from "@/hooks/useBilling";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Zap,
  Building2,
  Rocket,
  ExternalLink,
  Loader2,
  RefreshCw,
  Users,
  Phone,
  MessageSquare,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Dynamically import heavy sections
const PlansSection = dynamic(
  () => import("@/components/billing/plans-section"),
  { ssr: false, loading: () => <PlansSkeleton /> },
);

const InvoicesSection = dynamic(
  () => import("@/components/billing/invoices-section"),
  { ssr: false, loading: () => <InvoicesSkeleton /> },
);

const PLAN_ICONS: Record<string, React.ReactNode> = {
  STARTER: <Zap className="w-6 h-6" />,
  PROFESSIONAL: <Rocket className="w-6 h-6" />,
  ENTERPRISE: <Building2 className="w-6 h-6" />,
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: {
    label: "Ativo",
    color: "text-green-700 bg-green-100 border-green-200",
  },
  active: {
    label: "Ativo",
    color: "text-green-700 bg-green-100 border-green-200",
  },
  trialing: {
    label: "Trial",
    color: "text-blue-700 bg-blue-100 border-blue-200",
  },
  canceled: {
    label: "Cancelado",
    color: "text-red-700 bg-red-100 border-red-200",
  },
  past_due: {
    label: "Em atraso",
    color: "text-orange-700 bg-orange-100 border-orange-200",
  },
};

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  paid: { label: "Pago", color: "text-green-700 bg-green-100" },
  PAID: { label: "Pago", color: "text-green-700 bg-green-100" },
  open: { label: "Pendente", color: "text-yellow-700 bg-yellow-100" },
  void: { label: "Cancelado", color: "text-muted-foreground bg-muted" },
  uncollectible: { label: "Incobrável", color: "text-red-700 bg-red-100" },
};

function PlansSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6 animate-pulse space-y-4">
            <div className="h-6 w-24 bg-muted rounded" />
            <div className="h-8 w-20 bg-muted rounded" />
            <div className="space-y-2">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-4 w-full bg-muted rounded" />
              ))}
            </div>
            <div className="h-10 w-full bg-muted rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InvoicesSkeleton() {
  return (
    <Card>
      <CardContent className="p-0 animate-pulse">
        <div className="space-y-3 p-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 w-full bg-muted rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BillingSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 animate-pulse">
            <div className="h-12 w-12 rounded-lg bg-muted" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6 animate-pulse space-y-4">
              <div className="h-6 w-24 bg-muted rounded" />
              <div className="h-8 w-20 bg-muted rounded" />
              <div className="space-y-2">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-4 w-full bg-muted rounded" />
                ))}
              </div>
              <div className="h-10 w-full bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function BillingPageContent() {
  const {
    subscription,
    plans,
    invoices,
    loading,
    error,
    currentPlan,
    startCheckout,
    openPortal,
    cancelSubscription,
    changePlan,
    reload,
  } = useBilling();

  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<"success" | "canceled" | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Memoize subscription data for child components
  const subscriptionMemo = useMemo(
    () => ({
      subscription: subscription?.subscription,
      company: subscription?.company,
    }),
    [subscription],
  );

  useEffect(() => {
    if (searchParams.get("success") === "true") setBanner("success");
    if (searchParams.get("canceled") === "true") setBanner("canceled");
  }, [searchParams]);

  const handleAction = async (key: string, fn: () => Promise<void>) => {
    setActionLoading(key);
    try {
      await fn();
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <BillingSkeleton />;

  if (error)
    return (
      <div className="max-w-5xl mx-auto">
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                Erro ao carregar cobrança
              </p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={reload}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );

  const activeSub = subscription?.subscription;
  const company = subscription?.company;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Faturamento</h1>
        <p className="text-muted-foreground">
          Gerencie sua assinatura e pagamentos.
        </p>
      </div>

      {/* Banners */}
      {banner === "success" && (
        <Card
          className="border-green-200 bg-green-50/50"
          role="status"
          aria-live="polite"
        >
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-sm font-medium text-green-800 flex-1">
              Assinatura ativada com sucesso!
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Dispensar mensagem"
              className="h-8 w-8"
              onClick={() => setBanner(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
      {banner === "canceled" && (
        <Card
          className="border-yellow-200 bg-yellow-50/50"
          role="status"
          aria-live="polite"
        >
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <span className="text-sm font-medium text-yellow-800 flex-1">
              Checkout cancelado. Nenhuma cobrança realizada.
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Dispensar mensagem"
              className="h-8 w-8"
              onClick={() => setBanner(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Assinatura Atual */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Assinatura Atual</h2>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 text-primary rounded-lg">
                  {PLAN_ICONS[currentPlan] || (
                    <CreditCard className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-lg capitalize">
                    {currentPlan.charAt(0) + currentPlan.slice(1).toLowerCase()}
                  </p>
                  {activeSub ? (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          STATUS_CONFIG[activeSub.status]?.color ||
                          "text-muted-foreground bg-muted"
                        }`}
                      >
                        {STATUS_CONFIG[activeSub.status]?.label ||
                          activeSub.status}
                      </span>
                      {activeSub.currentPeriodEnd && (
                        <span className="text-xs text-muted-foreground">
                          Renova em {formatDate(activeSub.currentPeriodEnd)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Plano gratuito
                    </p>
                  )}
                </div>
              </div>

              {/* Limites */}
              {company?.limits && (
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {company.limits.users === 1000
                      ? "∞"
                      : company.limits.users}{" "}
                    usuários
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    {company.limits.callsPerMonth === 10000
                      ? "∞"
                      : company.limits.callsPerMonth}{" "}
                    ligações
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {company.limits.chatsPerMonth === 10000
                      ? "∞"
                      : company.limits.chatsPerMonth}{" "}
                    chats
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {activeSub && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction("portal", openPortal)}
                    disabled={!!actionLoading}
                    className="gap-2"
                  >
                    {actionLoading === "portal" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    Gerenciar
                  </Button>
                )}
                {activeSub?.status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={!!actionLoading}
                    className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    {actionLoading === "cancel" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Planos - Lazy loaded */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Planos Disponíveis</h2>
        <Suspense fallback={<PlansSkeleton />}>
          <PlansSection
            plans={plans}
            currentPlan={currentPlan}
            hasStripe={!!activeSub}
            actionLoading={actionLoading}
            onAction={handleAction}
            startCheckout={startCheckout}
            changePlan={changePlan}
          />
        </Suspense>
      </section>

      {/* Faturas - Lazy loaded */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Histórico de Faturas</h2>
        <Suspense fallback={<InvoicesSkeleton />}>
          <InvoicesSection invoices={invoices} />
        </Suspense>
      </section>

      {/* =============================================
          MODAL: Confirmar Cancelamento
          ============================================= */}
      {showCancelConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowCancelConfirm(false)}
        >
          <div
            className="bg-background rounded-xl shadow-2xl w-full max-w-sm m-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mx-auto">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Cancelar assinatura</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  O acesso ao plano atual permanece até o fim do período de
                  cobrança.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCancelConfirm(false)}
                >
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setShowCancelConfirm(false);
                    handleAction("cancel", cancelSubscription);
                  }}
                  disabled={!!actionLoading}
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingSkeleton />}>
      <BillingPageContent />
    </Suspense>
  );
}
