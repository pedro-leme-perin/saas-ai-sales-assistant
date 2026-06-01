'use client';

// Public /empresa page — institutional transparency (B2B credibility).
// Shows company identity (Razão Social, CNPJ, CNAEs, sede, regime tributário, foro,
// sócio único). Required for enterprise sales / due diligence / vendor onboarding.
// Middleware: /empresa(.*) is public (no auth required).

import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import {
  Sparkles,
  Building2,
  MapPin,
  Briefcase,
  ShieldCheck,
  FileText,
  Mail,
  ArrowRight,
  User,
  Scale,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface InfoRow {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const COMPANY_FACTS: InfoRow[] = [
  {
    icon: <Building2 className="w-4 h-4 text-primary" />,
    label: 'Razão Social',
    value: 'THEIADVISOR SAAS TECNOLOGIA LTDA',
  },
  {
    icon: <Briefcase className="w-4 h-4 text-primary" />,
    label: 'Nome Fantasia',
    value: 'TheIAdvisor',
  },
  {
    icon: <FileText className="w-4 h-4 text-primary" />,
    label: 'CNPJ',
    value: '67.084.607/0001-78',
  },
  {
    icon: <ShieldCheck className="w-4 h-4 text-primary" />,
    label: 'Situação Cadastral',
    value: 'ATIVA',
  },
  {
    icon: <Building2 className="w-4 h-4 text-primary" />,
    label: 'Natureza Jurídica',
    value: '206-2 — Sociedade Limitada Unipessoal (SLU)',
  },
  {
    icon: <Briefcase className="w-4 h-4 text-primary" />,
    label: 'Porte',
    value: 'ME — Microempresa',
  },
  {
    icon: <FileText className="w-4 h-4 text-primary" />,
    label: 'Atividade Principal (CNAE)',
    value:
      '6203-1/00 — Desenvolvimento e licenciamento de programas de computador não-customizáveis',
  },
  {
    icon: <FileText className="w-4 h-4 text-primary" />,
    label: 'Atividades Secundárias (CNAE)',
    value: '6202-3/00 · 6201-5/01 · 6311-9/00 · 6204-0/00',
  },
  {
    icon: <Briefcase className="w-4 h-4 text-primary" />,
    label: 'Regime Tributário',
    value: 'Simples Nacional (Anexo III via Fator R)',
  },
  {
    icon: <MapPin className="w-4 h-4 text-primary" />,
    label: 'Sede',
    value: 'Rua Guilherme Faim, 20 — Ribeirão Preto/SP — Brasil',
  },
  {
    icon: <Scale className="w-4 h-4 text-primary" />,
    label: 'Foro',
    value: 'Comarca de Ribeirão Preto/SP',
  },
  {
    icon: <User className="w-4 h-4 text-primary" />,
    label: 'Sócio Único',
    value: 'Pedro Leme Perin (CPF 438.360.178-22)',
  },
  {
    icon: <FileText className="w-4 h-4 text-primary" />,
    label: 'Constituição',
    value: '01/06/2026 — Protocolo REDESIM SPP2630711235',
  },
];

const CONTACT_BLOCKS = [
  {
    title: 'Comercial e Suporte',
    icon: <Mail className="w-5 h-5 text-primary" />,
    email: 'team@theiadvisor.com',
    description: 'Vendas, onboarding, suporte técnico, dúvidas comerciais.',
  },
  {
    title: 'Encarregado de Proteção de Dados (DPO)',
    icon: <ShieldCheck className="w-5 h-5 text-primary" />,
    email: 'dpo@theiadvisor.com',
    description:
      'Requisições LGPD Art. 18 (acesso, portabilidade, correção, deleção), dúvidas de privacidade.',
  },
];

export default function EmpresaPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <Sparkles className="w-6 h-6 text-primary" />
            TheIAdvisor
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm hover:text-primary transition-colors">
              Planos
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
                <Button size="sm">Dashboard</Button>
              </Link>
            </SignedIn>
          </nav>
        </div>
      </header>

      <section className="container mx-auto px-4 py-16 md:py-20 max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-6">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Quem somos</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transparência institucional completa. Dados públicos da pessoa jurídica responsável pela
            plataforma TheIAdvisor.
          </p>
        </div>

        <Card className="p-6 md:p-8 mb-10">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Dados cadastrais
          </h2>
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {COMPANY_FACTS.map((row) => (
              <div key={row.label}>
                <dt className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  {row.icon}
                  {row.label}
                </dt>
                <dd className="text-sm font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-6 md:p-8 mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Nossa missão
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground mb-3">
            A TheIAdvisor desenvolve um SaaS de assistência de vendas baseado em inteligência
            artificial. Nossa plataforma transcreve ligações em tempo real e analisa conversas no
            WhatsApp Business para sugerir as melhores respostas aos vendedores enquanto eles falam
            com o cliente.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Construímos enterprise-grade desde o primeiro commit: ACID em todas as operações
            críticas, multi-tenancy estrito, observabilidade completa (SLOs 99,9% disponibilidade),
            conformidade LGPD ponta a ponta, criptografia em trânsito e em repouso. Sem decisões de
            &ldquo;MVP descartável&rdquo;.
          </p>
        </Card>

        <Card className="p-6 md:p-8 mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Compliance e governança
          </h2>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="text-primary font-bold flex-shrink-0">·</span>
              <span>
                <strong>LGPD (Lei 13.709/2018):</strong> Controlador declarado nos Termos de Uso e
                Política de Privacidade. Workflow completo para Art. 18 (acesso, portabilidade,
                correção, deleção, anonimização). DPO designado:{' '}
                <a href="mailto:dpo@theiadvisor.com" className="text-primary hover:underline">
                  dpo@theiadvisor.com
                </a>
                .
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold flex-shrink-0">·</span>
              <span>
                <strong>Auditoria:</strong> Todo evento sensível registrado em audit trail imutável
                com retenção mínima de 180 dias (LGPD floor).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold flex-shrink-0">·</span>
              <span>
                <strong>Segurança:</strong> Helmet + CSP + HSTS, WSS obrigatório em produção,
                webhook signature timing-safe, multi-fator (Clerk), RBAC hierárquico em todas as
                rotas mutativas.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold flex-shrink-0">·</span>
              <span>
                <strong>Backup:</strong> Banco de dados em backup diário criptografado, retenção 30
                dias, restore game-day testado semestralmente.
              </span>
            </li>
          </ul>
        </Card>

        <Card className="p-6 md:p-8 mb-10">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Contato institucional
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {CONTACT_BLOCKS.map((block) => (
              <div
                key={block.email}
                className="p-4 rounded-lg border border-border bg-card flex flex-col"
              >
                <div className="flex items-center gap-2 mb-2">
                  {block.icon}
                  <h3 className="font-semibold text-sm">{block.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3 flex-1">{block.description}</p>
                <a
                  href={`mailto:${block.email}`}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  {block.email}
                </a>
              </div>
            ))}
          </div>
        </Card>

        <div className="text-center">
          <Link href="/pricing">
            <Button size="lg">
              Ver planos e preços
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
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
            <Link href="/pricing" className="hover:text-foreground transition-colors">
              Planos
            </Link>
          </div>
          <div className="mt-4 pt-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>THEIADVISOR SAAS TECNOLOGIA LTDA</span>
            <span className="hidden sm:inline">·</span>
            <span>CNPJ 67.084.607/0001-78</span>
            <span className="hidden sm:inline">·</span>
            <span>Rua Guilherme Faim, 20 - Ribeirão Preto/SP</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
