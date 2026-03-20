import {
  PrismaClient,
  Plan,
  CompanySize,
  UserRole,
  UserStatus,
  CallDirection,
  CallStatus,
  SentimentLabel,
  ChatStatus,
  ChatPriority,
  MessageType,
  MessageDirection,
  MessageStatus,
  SuggestionType,
  SuggestionFeedback,
  AuditAction,
  NotificationType,
  NotificationChannel,
  AuditAction as AuditActionEnum,
} from '@prisma/client';
import { faker } from '@faker-js/faker/locale/pt_BR';

const prisma = new PrismaClient();

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function generateBrazilianPhone(): string {
  const areaCode = String(11 + Math.floor(Math.random() * 84)).padStart(2, '0');
  const first = String(9 + Math.floor(Math.random() * 1)).toString();
  const rest = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
  return `+55${areaCode}${first}${rest}`;
}

function generateSentimentScore(): number {
  return Math.round((Math.random() * 0.7 + 0.25) * 100) / 100; // 0.25 - 0.95
}

function getSentimentLabel(score: number): SentimentLabel {
  if (score >= 0.8) return SentimentLabel.VERY_POSITIVE;
  if (score >= 0.6) return SentimentLabel.POSITIVE;
  if (score >= 0.4) return SentimentLabel.NEUTRAL;
  if (score >= 0.2) return SentimentLabel.NEGATIVE;
  return SentimentLabel.VERY_NEGATIVE;
}

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePastDate(daysAgo: number = 30): Date {
  const now = new Date();
  const randomDays = Math.floor(Math.random() * daysAgo);
  const randomHours = Math.floor(Math.random() * 24);
  const randomMinutes = Math.floor(Math.random() * 60);

  const date = new Date(now);
  date.setDate(date.getDate() - randomDays);
  date.setHours(randomHours, randomMinutes, 0, 0);
  return date;
}

// =====================================================
// SALES CALL TRANSCRIPTS (Portuguese)
// =====================================================

const callTranscripts = [
  'Cliente expressa interesse no plano Professional. Explicadas funcionalidades de IA em tempo real. Cliente pediu proposta por email.',
  'Inbound: Prospect pergunta sobre integração com Twilio. Confirmado que temos suporte nativo. Agendada demo para segunda-feira.',
  'Follow-up da proposta enviada há 3 dias. Cliente já testou plataforma e quer negociar preço. Proposto desconto de 10% para annual.',
  'Cliente atual reporta problema com webhook do WhatsApp. Suporte técnico agendado. Cliente satisfeito com resposta rápida.',
  'Apresentação completa da plataforma. Cliente fechou contrato para 5 licenças do plano Enterprise. Implementação iniciada.',
  'Prospect do setor imobiliário interessado em automação de ligações. Explicadas capacidades de análise de sentimento.',
  'Cliente questiona diferenças entre plano PROFESSIONAL e ENTERPRISE. Detalhou limites de API calls e suporte prioritário.',
  'Cancelamento de assinatura. Cliente citou falta de relatórios customizáveis. Oferecido trial estendido com features custom.',
  'Inbound: Cliente novo interessado em trial. Criada conta de demonstração. Login enviado. Demo agendada para amanhã.',
  'Reunião com CFO do cliente. Discussão sobre ROI. Cliente mostrou entusiasmo com redução de custos operacionais.',
  'Seguimento: Cliente não respondeu aos últimos 3 emails. Deixada mensagem de voz. Será tentado contato em 5 dias.',
  'Feedback positivo após implementação. Cliente reporta aumento de 35% em taxa de conversão com IA suggestions.',
  'Prospect quer proof-of-concept de 2 semanas. Proposto plano especial com suporte dedicado. Cliente aceitou.',
  'Cliente reclamou sobre latência na sugestão de IA. Investigação revelou circuit breaker ativo. Explicado o motivo e ajustado timeout.',
  'Novo prospect de startup. Orçamento limitado. Proposto plano STARTER com upgrade gradual. Cliente demonstrou interesse.',
  'Reunião com decisor técnico. Explicadas arquitetura escalável e compliance. Cliente quer conversar com outras empresas que usam.',
  'Inbound de agência de marketing. Vendem para clientes PME. Interesse em plano white-label. Escalado para Commercial.',
  'Cliente solicita integrações com Salesforce e HubSpot. Explicado que temos API REST documentada. Cliente vai avaliar custom integration.',
  'Após 6 meses, cliente quer expandir para 10 licenças. Ajustes feitos na faturação. Cliente muito satisfeito com produto.',
  'Prospect concorrente pesquisa features. Demonstrado diferenciais: latência < 200ms, suporte 24/7, compliance LGPD.',
];

// =====================================================
// WHATSAPP CONVERSATIONS (Portuguese)
// =====================================================

const whatsappConversations = [
  [
    { role: 'customer', content: 'Olá! Tudo bem? Vocês têm assistente de IA para WhatsApp Business?' },
    { role: 'vendor', content: 'Oi! Tudo bem sim! Sim, temos. Podemos configurar sugestões de IA em tempo real para suas respostas.' },
    { role: 'customer', content: 'Muito legal! Qual é o custo?' },
    { role: 'vendor', content: 'Temos planos a partir de R$ 99/mês. Quer conhecer melhor? Posso agendar uma demo!' },
    { role: 'customer', content: 'Tudo bem! Qual melhor horário amanhã?' },
  ],
  [
    { role: 'customer', content: 'Boa noite, gostaria de saber se vocês oferecem análise de sentimento das conversas.' },
    { role: 'vendor', content: 'Boa noite! Sim, oferecemos análise de sentimento em tempo real e relatórios detalhados.' },
    { role: 'vendor', content: 'Isso ajuda você a identificar clientes insatisfeitos e melhorar o atendimento.' },
    { role: 'customer', content: 'Perfeito! Isso é exatamente o que eu procurava.' },
  ],
  [
    { role: 'customer', content: 'Como funciona a integração com meu sistema atual?' },
    { role: 'vendor', content: 'Temos API REST bem documentada. Nosso time técnico pode ajudar na integração.' },
    { role: 'customer', content: 'Ok, e qual é o tempo médio de implementação?' },
    { role: 'vendor', content: 'Dependendo da complexidade, entre 2-5 dias. Você quer começar?' },
  ],
  [
    { role: 'customer', content: 'Vocês fazem suporte em português?' },
    { role: 'vendor', content: 'Com certeza! Nosso time fala português nativo. Suporte 24/7 para plano Enterprise.' },
    { role: 'customer', content: 'Excelente! Quero contratar.' },
  ],
  [
    { role: 'customer', content: 'Qual é a diferença entre plano STARTER e PROFESSIONAL?' },
    { role: 'vendor', content: 'STARTER: até 100 chats/mês, sugestões básicas, sem API.\nPROFESSIONAL: até 1000 chats/mês, IA avançada, API completa.' },
    { role: 'customer', content: 'Preciso de API. Vou de PROFESSIONAL então!' },
  ],
];

// =====================================================
// AI SUGGESTIONS (Portuguese)
// =====================================================

const aiSuggestions = [
  {
    type: SuggestionType.GREETING,
    content: 'Que bom ter você conosco! Como posso ajudar?',
  },
  {
    type: SuggestionType.OBJECTION_HANDLING,
    content: 'Entendo sua preocupação com o custo. Deixa eu mostrar o ROI que outros clientes alcançaram...',
  },
  {
    type: SuggestionType.CLOSING,
    content: 'Perfeito! Vou preparar a proposta com essas configurações e envio ainda hoje.',
  },
  {
    type: SuggestionType.QUESTION,
    content: 'Qual é o tamanho do seu time de vendas atualmente?',
  },
  {
    type: SuggestionType.INFORMATION,
    content: 'Nossa plataforma integra com Twilio, nativa para WhatsApp Business, com análise de sentimento em tempo real.',
  },
  {
    type: SuggestionType.FOLLOW_UP,
    content: 'Como ficou essa implementação que começamos semana passada?',
  },
  {
    type: SuggestionType.EMPATHY,
    content: 'Sinto a frustração. Vamos resolver isso juntos. Deixa eu conectar você com nosso time técnico.',
  },
  {
    type: SuggestionType.RAPPORT,
    content: 'Que legal! Você também trabalhou com Salesforce? Temos ótimas histórias de integração lá.',
  },
];

// =====================================================
// MAIN SEED FUNCTION
// =====================================================

async function main() {
  console.log('🌱 Iniciando seed de dados de demonstração...\n');
  console.log('=' .repeat(70));

  try {
    // ===================================================
    // 1. CREATE DEMO COMPANIES
    // ===================================================
    console.log('\n📦 Criando empresas de demonstração...');

    const companies = await Promise.all([
      prisma.company.upsert({
        where: { id: 'demo-company-acme' },
        update: {},
        create: {
          id: 'demo-company-acme',
          name: 'ACME Sales Solutions',
          slug: 'acme-sales',
          plan: Plan.ENTERPRISE,
          stripeCustomerId: 'cus_demo_acme_001',
          billingEmail: 'billing@acme.example.com',
          industry: 'Software/SaaS',
          size: CompanySize.LARGE,
          timezone: 'America/Sao_Paulo',
          maxUsers: 50,
          maxCallsPerMonth: 10000,
          maxChatsPerMonth: 5000,
          isActive: true,
          settings: {
            language: 'pt-BR',
            dateFormat: 'dd/MM/yyyy',
            defaultAIProvider: 'openai',
          },
        },
      }),
      prisma.company.upsert({
        where: { id: 'demo-company-startup' },
        update: {},
        create: {
          id: 'demo-company-startup',
          name: 'TechStart Ventures',
          slug: 'techstart',
          plan: Plan.PROFESSIONAL,
          stripeCustomerId: 'cus_demo_startup_001',
          billingEmail: 'admin@techstart.example.com',
          industry: 'E-commerce',
          size: CompanySize.SMALL,
          timezone: 'America/Sao_Paulo',
          maxUsers: 10,
          maxCallsPerMonth: 500,
          maxChatsPerMonth: 300,
          isActive: true,
          settings: {
            language: 'pt-BR',
            defaultAIProvider: 'claude',
          },
        },
      }),
      prisma.company.upsert({
        where: { id: 'demo-company-realestate' },
        update: {},
        create: {
          id: 'demo-company-realestate',
          name: 'Prime Imóveis',
          slug: 'prime-imoveis',
          plan: Plan.STARTER,
          stripeCustomerId: 'cus_demo_realestate_001',
          billingEmail: 'financeiro@primeimoveis.example.com',
          industry: 'Real Estate',
          size: CompanySize.MEDIUM,
          timezone: 'America/Sao_Paulo',
          maxUsers: 5,
          maxCallsPerMonth: 100,
          maxChatsPerMonth: 100,
          isActive: true,
          settings: {
            language: 'pt-BR',
          },
        },
      }),
    ]);

    console.log(`✅ ${companies.length} empresas criadas`);
    companies.forEach((c) => {
      console.log(`   - ${c.name} (${c.plan})`);
    });

    // ===================================================
    // 2. CREATE DEMO USERS (Multiple per company)
    // ===================================================
    console.log('\n👥 Criando usuários de demonstração...');

    const users: Record<string, any[]> = {};

    for (const company of companies) {
      const roleDistribution = [UserRole.OWNER, UserRole.ADMIN, UserRole.VENDOR, UserRole.VENDOR];
      users[company.id] = [];

      for (let i = 0; i < roleDistribution.length; i++) {
        const user = await prisma.user.upsert({
          where: { clerkId: `demo-user-${company.id}-${i}` },
          update: {},
          create: {
            id: `user-${company.id}-${i}`,
            clerkId: `demo-user-${company.id}-${i}`,
            email: `user${i}@${company.slug}.example.com`,
            name: faker.person.fullName(),
            avatarUrl: faker.image.avatar(),
            phone: generateBrazilianPhone(),
            role: roleDistribution[i],
            status: UserStatus.ACTIVE,
            isActive: true,
            companyId: company.id,
            permissions: ['calls.view', 'whatsapp.view', 'analytics.view'],
            notificationPreferences: {
              callStarted: true,
              newMessage: true,
              aiSuggestion: true,
            },
          },
        });
        users[company.id].push(user);
      }

      console.log(`   - Empresa "${company.name}": ${users[company.id].length} usuários criados`);
    }

    // ===================================================
    // 3. CREATE CALLS WITH REALISTIC DATA
    // ===================================================
    console.log('\n📞 Criando ligações de demonstração...');

    let callCount = 0;
    const callStatuses = [
      CallStatus.COMPLETED,
      CallStatus.COMPLETED,
      CallStatus.COMPLETED,
      CallStatus.FAILED,
      CallStatus.NO_ANSWER,
      CallStatus.BUSY,
    ];

    for (const company of companies) {
      const companyUsers = users[company.id];
      const callsPerCompany = Math.floor(20 + Math.random() * 10); // 20-30 calls per company

      for (let i = 0; i < callsPerCompany; i++) {
        const status = getRandomElement(callStatuses);
        const sentiment = generateSentimentScore();
        const duration = status === CallStatus.COMPLETED ? 60 + Math.floor(Math.random() * 900) : 0; // 1-15 min or 0
        const createdAt = generatePastDate(30);
        const startedAt = new Date(createdAt);
        const endedAt = status === CallStatus.COMPLETED ? new Date(startedAt.getTime() + duration * 1000) : null;

        const call = await prisma.call.create({
          data: {
            phoneNumber: generateBrazilianPhone(),
            contactName: faker.person.fullName(),
            direction: getRandomElement([CallDirection.INBOUND, CallDirection.OUTBOUND]),
            status,
            duration,
            transcript: status === CallStatus.COMPLETED ? getRandomElement(callTranscripts) : null,
            summary:
              status === CallStatus.COMPLETED
                ? `${faker.word.words(10)} - Sentiment: ${sentiment.toFixed(2)}`
                : null,
            sentiment: status === CallStatus.COMPLETED ? sentiment : null,
            sentimentLabel: status === CallStatus.COMPLETED ? getSentimentLabel(sentiment) : null,
            keywords: status === CallStatus.COMPLETED ? faker.helpers.multiple(faker.word.word, { count: 3 }) : [],
            actionItems:
              status === CallStatus.COMPLETED
                ? {
                    items: [
                      { action: 'Agendar demo', owner: 'Sales', dueDate: new Date(Date.now() + 86400000) },
                      { action: 'Enviar proposta', owner: 'Inside Sales', dueDate: new Date(Date.now() + 172800000) },
                    ],
                  }
                : null,
            tags: faker.helpers.multiple(() => faker.word.adjective(), { count: 2 }),
            notes: status === CallStatus.COMPLETED ? faker.lorem.paragraph() : null,
            metadata: {
              callerId: generateBrazilianPhone(),
              dialedNumber: generateBrazilianPhone(),
            },
            startedAt,
            endedAt,
            createdAt,
            userId: getRandomElement(companyUsers).id,
            companyId: company.id,
          },
        });

        callCount++;

        // Create AI Suggestions for completed calls
        if (status === CallStatus.COMPLETED && Math.random() > 0.3) {
          const suggestion = getRandomElement(aiSuggestions);
          await prisma.aiSuggestion.create({
            data: {
              type: suggestion.type,
              content: suggestion.content,
              confidence: 0.75 + Math.random() * 0.24,
              triggerText: call.transcript?.substring(0, 100) || null,
              wasUsed: Math.random() > 0.5,
              usedAt: Math.random() > 0.5 ? new Date() : null,
              feedback: Math.random() > 0.7 ? getRandomElement(Object.values(SuggestionFeedback)) : null,
              model: getRandomElement(['gpt-4o-mini', 'claude-3-sonnet', 'gemini-pro']),
              promptTokens: Math.floor(100 + Math.random() * 500),
              completionTokens: Math.floor(50 + Math.random() * 200),
              latencyMs: Math.floor(150 + Math.random() * 1500),
              callId: call.id,
              userId: getRandomElement(companyUsers).id,
            },
          });
        }
      }

      console.log(`   - Empresa "${company.name}": ${callsPerCompany} ligações criadas`);
    }

    console.log(`✅ Total: ${callCount} ligações criadas`);

    // ===================================================
    // 4. CREATE WHATSAPP CHATS WITH MESSAGES
    // ===================================================
    console.log('\n💬 Criando chats do WhatsApp com mensagens...');

    let chatCount = 0;
    let messageCount = 0;

    for (const company of companies) {
      const companyUsers = users[company.id];
      const chatsPerCompany = Math.floor(5 + Math.random() * 8); // 5-12 chats

      for (let i = 0; i < chatsPerCompany; i++) {
        const chat = await prisma.whatsappChat.create({
          data: {
            customerPhone: generateBrazilianPhone(),
            customerName: faker.person.fullName(),
            customerAvatar: faker.image.avatar(),
            status: getRandomElement([ChatStatus.OPEN, ChatStatus.ACTIVE, ChatStatus.RESOLVED, ChatStatus.ARCHIVED]),
            priority: getRandomElement([ChatPriority.LOW, ChatPriority.NORMAL, ChatPriority.HIGH, ChatPriority.URGENT]),
            unreadCount: Math.floor(Math.random() * 5),
            tags: faker.helpers.multiple(faker.word.adjective, { count: 2 }),
            lastMessageAt: generatePastDate(7),
            lastMessagePreview: faker.lorem.sentence().substring(0, 50),
            metadata: {
              source: 'whatsapp-business',
              source_id: `wa-${Math.random().toString(36).substring(7)}`,
            },
            createdAt: generatePastDate(30),
            userId: Math.random() > 0.3 ? getRandomElement(companyUsers).id : null,
            companyId: company.id,
          },
        });

        // Create messages in each chat
        const conversation = getRandomElement(whatsappConversations);
        let messageTime = new Date(chat.createdAt);

        for (const msg of conversation) {
          messageTime = new Date(messageTime.getTime() + 30000 + Math.random() * 300000); // Random gaps between messages

          const message = await prisma.whatsappMessage.create({
            data: {
              waMessageId: `wa_msg_${Math.random().toString(36).substring(7)}`,
              type: MessageType.TEXT,
              direction: msg.role === 'customer' ? MessageDirection.INCOMING : MessageDirection.OUTGOING,
              status: getRandomElement([MessageStatus.SENT, MessageStatus.DELIVERED, MessageStatus.READ]),
              content: msg.content,
              sentAt: messageTime,
              deliveredAt: msg.role === 'vendor' ? new Date(messageTime.getTime() + 2000) : null,
              readAt: msg.role === 'customer' ? new Date(messageTime.getTime() + 5000) : null,
              createdAt: messageTime,
              chatId: chat.id,
              aiSuggestionUsed: msg.role === 'vendor' && Math.random() > 0.5,
            },
          });

          // Create AI Suggestion for some outgoing messages
          if (msg.role === 'vendor' && Math.random() > 0.4) {
            await prisma.aiSuggestion.create({
              data: {
                type: getRandomElement([
                  SuggestionType.GREETING,
                  SuggestionType.OBJECTION_HANDLING,
                  SuggestionType.INFORMATION,
                  SuggestionType.CLOSING,
                ]),
                content: msg.content,
                confidence: 0.8 + Math.random() * 0.2,
                triggerText: conversation[Math.max(0, conversation.indexOf(msg) - 1)].content.substring(0, 100),
                wasUsed: Math.random() > 0.4,
                usedAt: Math.random() > 0.5 ? messageTime : null,
                feedback: Math.random() > 0.8 ? SuggestionFeedback.HELPFUL : null,
                model: getRandomElement(['gpt-4o-mini', 'claude-3-sonnet']),
                promptTokens: Math.floor(80 + Math.random() * 200),
                completionTokens: Math.floor(20 + Math.random() * 100),
                latencyMs: Math.floor(100 + Math.random() * 800),
                chatId: chat.id,
                userId: chat.userId,
              },
            });
          }

          messageCount++;
        }

        chatCount++;
      }

      console.log(`   - Empresa "${company.name}": ${chatsPerCompany} chats criados`);
    }

    console.log(`✅ Total: ${chatCount} chats com ${messageCount} mensagens`);

    // ===================================================
    // 5. CREATE NOTIFICATIONS
    // ===================================================
    console.log('\n🔔 Criando notificações de demonstração...');

    let notificationCount = 0;

    for (const company of companies) {
      const companyUsers = users[company.id];

      // Create 10 notifications per company
      for (let i = 0; i < 10; i++) {
        await prisma.notification.create({
          data: {
            type: getRandomElement([
              NotificationType.CALL_STARTED,
              NotificationType.CALL_ENDED,
              NotificationType.NEW_MESSAGE,
              NotificationType.AI_SUGGESTION,
              NotificationType.SUBSCRIPTION_UPDATE,
            ]),
            title: faker.lorem.sentence().substring(0, 60),
            message: faker.lorem.paragraph(),
            channel: getRandomElement([NotificationChannel.IN_APP, NotificationChannel.EMAIL]),
            read: Math.random() > 0.5,
            readAt: Math.random() > 0.7 ? new Date() : null,
            sentAt: new Date(),
            createdAt: generatePastDate(7),
            userId: getRandomElement(companyUsers).id,
            companyId: company.id,
          },
        });

        notificationCount++;
      }
    }

    console.log(`✅ Total: ${notificationCount} notificações criadas`);

    // ===================================================
    // 6. CREATE AUDIT LOGS
    // ===================================================
    console.log('\n📝 Criando audit logs de demonstração...');

    let auditLogCount = 0;
    const auditActions = [
      AuditAction.CREATE,
      AuditAction.READ,
      AuditAction.UPDATE,
      AuditAction.LOGIN,
      AuditAction.EXPORT,
    ];

    for (const company of companies) {
      const companyUsers = users[company.id];

      // Create 15 audit logs per company
      for (let i = 0; i < 15; i++) {
        await prisma.auditLog.create({
          data: {
            action: getRandomElement(auditActions),
            resource: getRandomElement(['Call', 'WhatsappChat', 'User', 'Subscription']),
            resourceId: faker.string.uuid(),
            description: faker.lorem.sentence(),
            oldValues: { status: 'PENDING' },
            newValues: { status: 'COMPLETED' },
            ipAddress: faker.internet.ipv4(),
            userAgent: faker.internet.userAgent(),
            requestId: faker.string.uuid(),
            createdAt: generatePastDate(30),
            userId: getRandomElement(companyUsers).id,
            companyId: company.id,
          },
        });

        auditLogCount++;
      }
    }

    console.log(`✅ Total: ${auditLogCount} audit logs criados`);

    // ===================================================
    // FINAL SUMMARY
    // ===================================================
    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMO DO SEED DE DADOS');
    console.log('=' .repeat(70));

    console.log('\n🏢 EMPRESAS:');
    for (const company of companies) {
      const userCount = await prisma.user.count({ where: { companyId: company.id } });
      const callCount = await prisma.call.count({ where: { companyId: company.id } });
      const chatCount = await prisma.whatsappChat.count({ where: { companyId: company.id } });
      const messageCount = await prisma.whatsappMessage.count({
        where: { chat: { companyId: company.id } },
      });
      const notificationCount = await prisma.notification.count({ where: { companyId: company.id } });
      const auditLogCount = await prisma.auditLog.count({ where: { companyId: company.id } });

      console.log(`\n   ${company.name} (${company.plan})`);
      console.log(`      ID: ${company.id}`);
      console.log(`      👥 Usuários: ${userCount}`);
      console.log(`      📞 Ligações: ${callCount}`);
      console.log(`      💬 Chats WhatsApp: ${chatCount}`);
      console.log(`      💭 Mensagens: ${messageCount}`);
      console.log(`      🔔 Notificações: ${notificationCount}`);
      console.log(`      📝 Audit Logs: ${auditLogCount}`);
    }

    const totalStats = {
      users: await prisma.user.count(),
      calls: await prisma.call.count(),
      whatsappChats: await prisma.whatsappChat.count(),
      whatsappMessages: await prisma.whatsappMessage.count(),
      aiSuggestions: await prisma.aiSuggestion.count(),
      notifications: await prisma.notification.count(),
      auditLogs: await prisma.auditLog.count(),
    };

    console.log('\n' + '-'.repeat(70));
    console.log('📈 TOTAIS GERAIS:');
    console.log('-'.repeat(70));
    console.log(`   👥 Usuários: ${totalStats.users}`);
    console.log(`   📞 Ligações: ${totalStats.calls}`);
    console.log(`   💬 Chats WhatsApp: ${totalStats.whatsappChats}`);
    console.log(`   💭 Mensagens: ${totalStats.whatsappMessages}`);
    console.log(`   🤖 Sugestões de IA: ${totalStats.aiSuggestions}`);
    console.log(`   🔔 Notificações: ${totalStats.notifications}`);
    console.log(`   📝 Audit Logs: ${totalStats.auditLogs}`);

    console.log('\n' + '='.repeat(70));
    console.log('🎉 SEED COMPLETADO COM SUCESSO!');
    console.log('=' .repeat(70));
    console.log('\n✅ Dados de demonstração carregados e prontos para uso.\n');
  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ ERRO DURANTE O SEED');
    console.error('=' .repeat(70));
    console.error(error);
    console.error('=' .repeat(70) + '\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
