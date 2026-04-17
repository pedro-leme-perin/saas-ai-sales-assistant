import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export const dynamic = "force-dynamic";
import { Sparkles } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl">TheIAdvisor</span>
          </Link>

          <h1 className="text-2xl font-bold mb-2">Bem-vindo de volta</h1>
          <p className="text-muted-foreground mb-8">
            Entre na sua conta para continuar
          </p>

          <SignIn
            appearance={{
              elements: {
                formButtonPrimary:
                  "bg-primary hover:bg-primary/90 text-primary-foreground",
                card: "shadow-none p-0",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton:
                  "border border-input bg-background hover:bg-accent",
                formFieldInput: "border-input bg-background focus:ring-ring",
                footerActionLink: "text-primary hover:text-primary/90",
              },
            }}
            routing="path"
            path="/login"
            signUpUrl="/register"
            fallbackRedirectUrl="/dashboard"
          />

          <p className="text-center text-sm text-muted-foreground mt-6">
            NÃ£o tem uma conta?{" "}
            <Link
              href="/register"
              className="text-primary hover:underline font-medium"
            >
              Criar conta
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Image/Gradient */}
      <div className="hidden lg:flex flex-1 gradient-primary items-center justify-center p-12">
        <div className="text-center text-white">
          <h2 className="text-3xl font-bold mb-4">
            Transforme suas vendas com IA
          </h2>
          <p className="text-white/80 max-w-md">
            Receba sugestÃµes inteligentes em tempo real durante suas ligaÃ§Ãµes
            e conversas no WhatsApp.
          </p>
        </div>
      </div>
    </div>
  );
}
