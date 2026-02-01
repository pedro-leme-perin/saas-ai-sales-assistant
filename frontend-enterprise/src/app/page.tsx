import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="z-10 w-full max-w-5xl items-center justify-center font-mono text-sm">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-white mb-8">
            🤖 SaaS AI Sales Assistant
          </h1>
          <p className="text-xl text-white/90 mb-12">
            Assistente de vendas com IA para ligações e WhatsApp
          </p>

          <SignedOut>
            <div className="flex gap-4 justify-center">
              <SignInButton mode="modal">
                <button className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition">
                  Entrar
                </button>
              </SignInButton>
              <Link href="/sign-up">
                <button className="bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-800 transition">
                  Criar Conta
                </button>
              </Link>
            </div>
          </SignedOut>

          <SignedIn>
            <div className="flex gap-4 justify-center items-center">
              <Link href="/dashboard">
                <button className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition">
                  Ir para Dashboard
                </button>
              </Link>
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </div>
      </div>
    </main>
  );
}