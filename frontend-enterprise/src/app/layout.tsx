import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers, AuthProvider } from '@/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'SalesAI — Assistente de Vendas com IA',
    template: '%s | SalesAI',
  },
  description:
    'Aumente suas vendas com inteligência artificial. Sugestões em tempo real durante ligações e WhatsApp para sua equipe fechar mais negócios.',
  keywords: [
    'vendas', 'IA', 'inteligência artificial', 'CRM',
    'WhatsApp Business', 'assistente de vendas', 'SaaS',
    'ligações', 'sales AI', 'produtividade',
  ],
  authors: [{ name: 'SalesAI' }],
  creator: 'SalesAI',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://saas-ai-sales-assistant.vercel.app'
  ),
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'SalesAI',
    title: 'SalesAI — Assistente de Vendas com IA',
    description:
      'Sugestões em tempo real durante ligações e WhatsApp. Sua equipe vende mais com menos esforço.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SalesAI — Assistente de Vendas com IA',
    description:
      'Sugestões em tempo real durante ligações e WhatsApp. Sua equipe vende mais com menos esforço.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="pt-BR" suppressHydrationWarning>
        <head>
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <meta name="theme-color" content="#09090b" />
        </head>
        <body className={inter.className}>
          <Providers>
            <AuthProvider>
              {children}
            </AuthProvider>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
