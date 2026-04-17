import Link from "next/link";
import { Sparkles, Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-6">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <p className="text-7xl font-bold text-primary mb-2">404</p>
        <h1 className="text-2xl font-bold mb-3">Pagina nao encontrada</h1>
        <p className="text-muted-foreground mb-8">
          A pagina que voce esta procurando nao existe ou foi movida.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Home className="h-4 w-4" /> Ir para Dashboard
        </Link>
      </div>
    </main>
  );
}
