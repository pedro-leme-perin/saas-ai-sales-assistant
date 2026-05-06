'use client';

// Public pricing page (S78 E/C1)
// Static plan data mirrors backend `BillingService.getPlans()` for SSR/SEO without
// requiring an API call (no Bearer token at this surface). When backend price changes,
// update both this file AND apps/backend/src/modules/billing/billing.service.ts.

import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import {
  Zap,
  Rocket,
  Building2,
  Check,
  ArrowRight,
  Phone,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PricingPlan {
  id: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  name: string;
  price: number;
  currency: 'BRL';
  icon: React.ReactNode;
  highlight?: boolean;
  features: string[];
  ctaLabel: string;
}

const PLANS: PricingPlan[] = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: 97,
    currency: 'BRL',
    icon: <Zap className="w-7 h-7" />,
    features: [
      'Até 5 usuários',
      '100 ligações/mês',
      '200 chats WhatsApp/mês',
      'Sugestões de IA básicas',
      'Relatórios básicos',
      'Suporte por email',
    ],
    ctaLabel: 'Começar agora',
  },
  {
    id: 'PROFESSIONAL',
    name: 'Professional',
    price: 297,
    currency: 'BRL',
    icon: <Rocket className="w-7 h-7" />,
    highlight: true,
    features: [
      'Até 20 usuários',
      '500 ligações/mês',
      '500 chats WhatsApp/mês',
      'Sugestões de IA avançadas',
      'Relatórios completos',
      'Integrações com CRM',
      'Suporte prioritário',
    ],
    ctaLabel: 'Escolher Professional',
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 697,
    currency: 'BRL',
    icon: <Building2 className="w-7 h-7" />,
    features: [
      'Usuários ilimitados',
      'Ligações ilimitadas',
      'Chats WhatsApp ilimitados',
      'IA personalizada',
      'API completa',
      'White-label',
      'Gerente de conta dedicado',
      'Suporte 24/7',
    ],
    ctaLabel: 'Falar com vendas',
  },
];

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <Sparkles className="w-6 h-6 text-primary" />
            TheIAdvisor
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/#features" className="text-sm hover:text-primary transition-colors">
              Recursos
            </Link>
            <Link href="/help" className="text-sm hover:text-primary transition-colors">
              Ajuda
            </Link>
            <SignedOut>
              <Link href="/sign-in">
                <Button variant="ghost" size="sm">
                  Entrar
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm">Cadastrar</Button>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <Button size="sm" variant="default">
                  Dashboard
                </Button>
              </Link>
            </SignedIn>
          </nav>
        </div>
      </header>

      <section className="container mx-auto px-4 py-16 md:py-24 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Planos e preços</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-2">
          Escolha o plano ideal para o seu time. Todos os planos incluem IA em tempo real para
          ligações e WhatsApp.
        </p>
        <p className="text-sm text-muted-foreground">
          Pagamento mensal · Cancele quando quiser · Sem fidelidade
        </p>
      </section>

      <section className="container mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`p-8 flex flex-col relative ${
                plan.highlight
                  ? 'border-primary shadow-lg ring-2 ring-primary/20 scale-105'
                  : 'border-border'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  Mais popular
                </div>
              )}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`p-2 rounded-lg ${
                    plan.highlight ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground'
                  }`}
                >
                  {plan.icon}
                </div>
                <h2 className="text-2xl font-bold">{plan.name}</h2>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold">{formatBRL(plan.price)}</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <SignedOut>
                <Link href={`/sign-up?plan=${plan.id}`} className="block">
                  <Button
                    className="w-full"
                    variant={plan.highlight ? 'default' : 'outline'}
                    size="lg"
                  >
                    {plan.ctaLabel}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </SignedOut>
              <SignedIn>
                <Link href={`/dashboard/billing?plan=${plan.id}`} className="block">
                  <Button
                    className="w-full"
                    variant={plan.highlight ? 'default' : 'outline'}
                    size="lg"
                  >
                    Ir para checkout
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </SignedIn>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20 max-w-3xl">
        <h2 className="text-2xl font-bold text-center mb-8">Perguntas frequentes</h2>
        <div className="space-y-4">
          <div className="p-6 border border-border rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              Posso usar com qualquer telefone?
            </h3>
            <p className="text-sm text-muted-foreground">
              Sim. Integração com Twilio para ligações + WhatsApp Business API oficial. Não precisa
              trocar de número.
            </p>
          </div>
          <div className="p-6 border border-border rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Como funciona o teste?
            </h3>
            <p className="text-sm text-muted-foreground">
              Comece com qualquer plano e cancele a qualquer momento direto pelo portal de cobrança.
              Sem multa, sem fidelidade.
            </p>
          </div>
          <div className="p-6 border border-border rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Posso mudar de plano depois?
            </h3>
            <p className="text-sm text-muted-foreground">
              Sim. Upgrade ou downgrade a qualquer momento. Cobrança proporcional automática via
              Stripe.
            </p>
          </div>
        </div>
        <div className="text-center mt-8">
          <Link href="/help">
            <Button variant="link">Ver todas as perguntas →</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} TheIAdvisor. Todos os direitos reservados.</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Termos
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacidade
            </Link>
            <Link href="/help" className="hover:text-foreground transition-colors">
              Ajuda
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
