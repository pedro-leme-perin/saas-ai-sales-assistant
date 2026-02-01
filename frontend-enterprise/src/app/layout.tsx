import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers, AuthProvider } from '@/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SaaS AI Sales Assistant',
  description: 'AI-powered sales assistant for calls and WhatsApp',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
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