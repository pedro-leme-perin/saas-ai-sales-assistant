import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import {
  Phone, MessageSquare, Sparkles, ArrowRight,
  BarChart3, Shield, Zap, CheckCircle,
} from 'lucide-react';

const features = [
  {
    icon: Phone,
    title: 'Ligações com IA',
    description: 'Transcrição em tempo real e sugestões inteligentes durante suas chamadas de vendas.',
    color: 'text-blue-500 bg-blue-500/10',
  },
  {
    icon: MessageSquare,
    title: 'WhatsApp Business',
    description: 'Análise de conversas e respostas sugeridas para fechar mais negócios.',
    color: 'text-green-500 bg-green-500/10',
  },
  {
    icon: Sparkles,
    title: 'IA Generativa',
    description: 'Sugestões contextuais baseadas no histórico da conversa e perfil do cliente.',
    color: 'text-purple-500 bg-purple-500/10',
  },
  {
    icon: BarChart3,
    title: 'Analytics Avançado',
    description: 'Métricas de performance, taxa de conversão e insights da equipe.',
    color: 'text-orange-500 bg-orange-500/10',
  },
];

const stats = [
  { value: '3x', label: 'mais produtividade' },
  { value: '40%', label: 'mais conversões' },
  { value: '<2s', label: 'tempo de resposta IA' },
  { value: '99.9%', label: 'uptime garantido' },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">SalesAI</span>
          </Link>
          <div className="flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Entrar
                </button>
              </SignInButton>
              <Link href="/sign-up">
                <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  Começar grátis
                </button>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2">
                  Dashboard <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-muted/50 text-sm text-muted-foreground mb-6">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Assistente de vendas potencializado por IA
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Feche mais vendas com{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              inteligência artificial
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Sugestões em tempo real durante ligações e WhatsApp. 
            Sua equipe vende mais com menos esforço.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignedOut>
              <Link href="/sign-up">
                <button className="bg-primary text-primary-foreground px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-primary/90 transition-all hover:shadow-lg flex items-center gap-2 justify-center w-full sm:w-auto">
                  Começar grátis <ArrowRight className="h-5 w-5" />
                </button>
              </Link>
              <SignInButton mode="modal">
                <button className="px-8 py-3.5 rounded-xl text-base font-semibold border hover:bg-muted transition-colors w-full sm:w-auto">
                  Já tenho conta
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <button className="bg-primary text-primary-foreground px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-primary/90 transition-all hover:shadow-lg flex items-center gap-2 justify-center">
                  Ir para Dashboard <ArrowRight className="h-5 w-5" />
                </button>
              </Link>
            </SignedIn>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              Tudo que sua equipe precisa
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Ferramentas inteligentes para potencializar cada interação de vendas.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-xl border bg-card hover:shadow-md transition-all hover:border-primary/20"
              >
                <div className={`inline-flex p-3 rounded-lg ${feature.color} mb-4`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-16 px-4 bg-muted/30 border-t">
        <div className="max-w-3xl mx-auto text-center">
          <Shield className="h-8 w-8 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Enterprise-grade desde o primeiro dia</h2>
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            {['Criptografia end-to-end', 'LGPD compliant', 'SOC 2 Type II'].map((item) => (
              <div key={item} className="flex items-center gap-2 justify-center text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto para vender mais?</h2>
          <p className="text-muted-foreground mb-8">
            Comece gratuitamente. Sem cartão de crédito.
          </p>
          <SignedOut>
            <Link href="/sign-up">
              <button className="bg-primary text-primary-foreground px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-primary/90 transition-all hover:shadow-lg inline-flex items-center gap-2">
                Criar conta grátis <ArrowRight className="h-5 w-5" />
              </button>
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <button className="bg-primary text-primary-foreground px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-primary/90 transition-all hover:shadow-lg inline-flex items-center gap-2">
                Ir para Dashboard <ArrowRight className="h-5 w-5" />
              </button>
            </Link>
          </SignedIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
              <Sparkles className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">SalesAI</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} SalesAI. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </main>
  );
}
