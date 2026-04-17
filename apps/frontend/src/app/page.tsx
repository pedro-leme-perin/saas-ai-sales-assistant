"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import {
  Phone,
  MessageSquare,
  Sparkles,
  ArrowRight,
  BarChart3,
  Shield,
  Zap,
  CheckCircle,
} from "lucide-react";
import { useTranslation } from "@/i18n/use-translation";

export default function Home() {
  const { t } = useTranslation();

  const features = [
    {
      icon: Phone,
      title: t("landing.feature1Title"),
      description: t("landing.feature1Desc"),
      color: "text-blue-500 bg-blue-500/10",
    },
    {
      icon: MessageSquare,
      title: t("landing.feature2Title"),
      description: t("landing.feature2Desc"),
      color: "text-green-500 bg-green-500/10",
    },
    {
      icon: Sparkles,
      title: t("landing.feature3Title"),
      description: t("landing.feature3Desc"),
      color: "text-purple-500 bg-purple-500/10",
    },
    {
      icon: BarChart3,
      title: t("landing.feature4Title"),
      description: t("landing.feature4Desc"),
      color: "text-orange-500 bg-orange-500/10",
    },
  ];

  const stats = [
    { value: t("landing.stat1Value"), label: t("landing.stat1Label") },
    { value: t("landing.stat2Value"), label: t("landing.stat2Label") },
    { value: t("landing.stat3Value"), label: t("landing.stat3Label") },
    { value: t("landing.stat4Value"), label: t("landing.stat4Label") },
  ];

  const trustBadges = [
    t("landing.trustBadge1"),
    t("landing.trustBadge2"),
    t("landing.trustBadge3"),
  ];
  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">TheIAdvisor</span>
          </Link>
          <div className="flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  {t("auth.signIn")}
                </button>
              </SignInButton>
              <Link href="/sign-up">
                <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  {t("landing.ctaStart")}
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
      <section className="pt-24 sm:pt-32 pb-16 sm:pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-muted/50 text-sm text-muted-foreground mb-6">
            <Zap className="h-3.5 w-3.5 text-primary" />
            {t("landing.badge")}
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            {t("landing.heroTitle")}{" "}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {t("landing.heroTitleHighlight")}
            </span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed">
            {t("landing.heroDescription")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignedOut>
              <Link href="/sign-up">
                <button className="bg-primary text-primary-foreground px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-primary/90 transition-all hover:shadow-lg flex items-center gap-2 justify-center w-full sm:w-auto">
                  {t("landing.ctaStart")} <ArrowRight className="h-5 w-5" />
                </button>
              </Link>
              <SignInButton mode="modal">
                <button className="px-8 py-3.5 rounded-xl text-base font-semibold border hover:bg-muted transition-colors w-full sm:w-auto">
                  {t("landing.ctaLogin")}
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <button className="bg-primary text-primary-foreground px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-primary/90 transition-all hover:shadow-lg flex items-center gap-2 justify-center">
                  {t("landing.ctaDashboard")} <ArrowRight className="h-5 w-5" />
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
                <p className="text-sm text-muted-foreground mt-1">
                  {stat.label}
                </p>
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
              {t("landing.featuresTitle")}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t("landing.featuresSubtitle")}
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-xl border bg-card hover:shadow-md transition-all hover:border-primary/20"
              >
                <div
                  className={`inline-flex p-3 rounded-lg ${feature.color} mb-4`}
                >
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
          <h2 className="text-2xl font-bold mb-4">{t("landing.trustTitle")}</h2>
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            {trustBadges.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 justify-center text-sm"
              >
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
          <h2 className="text-3xl font-bold mb-4">{t("landing.ctaTitle")}</h2>
          <p className="text-muted-foreground mb-8">
            {t("landing.ctaSubtitle")}
          </p>
          <SignedOut>
            <Link href="/sign-up">
              <button className="bg-primary text-primary-foreground px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-primary/90 transition-all hover:shadow-lg inline-flex items-center gap-2">
                {t("landing.ctaButton")} <ArrowRight className="h-5 w-5" />
              </button>
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <button className="bg-primary text-primary-foreground px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-primary/90 transition-all hover:shadow-lg inline-flex items-center gap-2">
                {t("landing.ctaDashboard")} <ArrowRight className="h-5 w-5" />
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
            <span className="text-sm font-semibold">TheIAdvisor</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/help"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("landing.help")}
            </Link>
            <Link
              href="/terms"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("landing.termsOfService")}
            </Link>
            <Link
              href="/privacy"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("landing.privacyPolicy")}
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} TheIAdvisor.{" "}
            {t("landing.footerRights")}
          </p>
        </div>
      </footer>
    </main>
  );
}
