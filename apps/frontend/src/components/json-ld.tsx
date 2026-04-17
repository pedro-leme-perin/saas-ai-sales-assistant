const BASE_URL = "https://www.theiadvisor.com";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "TheIAdvisor",
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  description:
    "Assistente de vendas com inteligencia artificial. Sugestoes em tempo real durante ligacoes e WhatsApp para sua equipe fechar mais negocios.",
  contactPoint: {
    "@type": "ContactPoint",
    email: "team@theiadvisor.com",
    contactType: "customer support",
    availableLanguage: ["Portuguese", "English"],
  },
  sameAs: [],
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "TheIAdvisor",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: BASE_URL,
  description:
    "SaaS de assistencia de vendas com IA. Transcricao em tempo real de ligacoes, sugestoes contextuais via WhatsApp e analytics de performance.",
  offers: [
    {
      "@type": "Offer",
      name: "Starter",
      price: "97.00",
      priceCurrency: "BRL",
      url: `${BASE_URL}/sign-up`,
      priceValidUntil: "2027-12-31",
    },
    {
      "@type": "Offer",
      name: "Professional",
      price: "297.00",
      priceCurrency: "BRL",
      url: `${BASE_URL}/sign-up`,
      priceValidUntil: "2027-12-31",
    },
    {
      "@type": "Offer",
      name: "Enterprise",
      price: "697.00",
      priceCurrency: "BRL",
      url: `${BASE_URL}/sign-up`,
      priceValidUntil: "2027-12-31",
    },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "O que e o TheIAdvisor?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "TheIAdvisor e um SaaS de assistencia de vendas com inteligencia artificial. Ele transcreve ligacoes em tempo real e sugere respostas para sua equipe de vendas, alem de analisar conversas no WhatsApp Business.",
      },
    },
    {
      "@type": "Question",
      name: "Como funciona a IA durante as ligacoes?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Durante uma ligacao, o TheIAdvisor transcreve o audio em tempo real usando Deepgram e envia sugestoes contextuais ao vendedor via WebSocket, com latencia inferior a 200ms.",
      },
    },
    {
      "@type": "Question",
      name: "Quais sao os planos disponiveis?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Oferecemos tres planos: Starter (R$97/mes), Professional (R$297/mes) e Enterprise (R$697/mes). Todos incluem acesso a IA de vendas, transcricao em tempo real e analytics.",
      },
    },
    {
      "@type": "Question",
      name: "O TheIAdvisor funciona com WhatsApp?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sim. O TheIAdvisor se integra com a API oficial do WhatsApp Business para analisar mensagens recebidas e sugerir respostas contextuais para sua equipe.",
      },
    },
    {
      "@type": "Question",
      name: "Posso testar antes de assinar?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sim. Oferecemos um periodo de teste gratuito para que voce possa avaliar todas as funcionalidades antes de escolher um plano.",
      },
    },
  ],
};

export function OrganizationJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(organizationSchema),
      }}
    />
  );
}

export function SoftwareApplicationJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(softwareApplicationSchema),
      }}
    />
  );
}

export function FAQPageJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(faqSchema),
      }}
    />
  );
}
