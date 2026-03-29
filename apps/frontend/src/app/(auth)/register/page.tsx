import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
import { Sparkles, CheckCircle2 } from 'lucide-react';

const benefits = [
  'IA para ligações em tempo real',
  'WhatsApp com sugestões inteligentes',
  'Dashboard de analytics',
  '7 dias de teste grátis',
];

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Benefits */}
      <div className="hidden lg:flex flex-1 gradient-primary items-center justify-center p-12">
        <div className="text-white max-w-md">
          <h2 className="text-3xl font-bold mb-6">
            Comece a vender mais hoje
          </h2>
          <ul className="space-y-4">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-white/90" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 p-4 rounded-lg bg-white/10 backdrop-blur">
            <p className="text-sm text-white/90">
              &ldquo;O SalesAI aumentou nossas conversões em 40% no primeiro mês.
              A IA realmente entende o contexto das conversas.&rdquo;
            </p>
            <p className="text-sm font-medium mt-2">
              — Maria S., Gerente de Vendas
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl">SalesAI</span>
          </Link>
          
          <h1 className="text-2xl font-bold mb-2">Criar conta</h1>
          <p className="text-muted-foreground mb-8">
            Comece seu teste grátis de 7 dias
          </p>

          <SignUp
            appearance={{
              elements: {
                formButtonPrimary:
                  'bg-primary hover:bg-primary/90 text-primary-foreground',
                card: 'shadow-none p-0',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton:
                  'border border-input bg-background hover:bg-accent',
                formFieldInput:
                  'border-input bg-background focus:ring-ring',
                footerActionLink: 'text-primary hover:text-primary/90',
              },
            }}
            routing="path"
            path="/register"
            signInUrl="/login"
            fallbackRedirectUrl="/dashboard"
          />

          <p className="text-center text-sm text-muted-foreground mt-6">
            Já tem uma conta?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
