// prisma/seed-test-data.ts
// Execute com: npx tsx prisma/seed-test-data.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de dados de teste...\n');

  // 1. Buscar usuário pelo email
  const user = await prisma.user.findFirst({
    where: { email: 'leme.baseapr@gmail.com' },
    include: { company: true },
  });

  if (!user) {
    console.error('❌ Usuário leme.baseapr@gmail.com não encontrado!');
    process.exit(1);
  }

  console.log(`✅ Usuário encontrado: ${user.name} (${user.email})`);
  console.log(`✅ Company: ${user.company.name} (${user.companyId})\n`);

  const companyId = user.companyId;
  const userId = user.id;

  // 2. Limpar dados antigos
  console.log('🧹 Limpando dados antigos...');
  await prisma.whatsappMessage.deleteMany({ 
    where: { chat: { companyId } } 
  });
  await prisma.whatsappChat.deleteMany({ where: { companyId } });
  console.log('✅ Dados antigos de WhatsApp removidos\n');

  // 3. Inserir WhatsApp Chats
  console.log('💬 Inserindo WhatsApp chats de teste...');

  const chat1 = await prisma.whatsappChat.create({
    data: {
      companyId,
      userId,
      customerPhone: '+5511999887766',
      customerName: 'Roberto Almeida',
      status: 'ACTIVE',
      priority: 'HIGH',
      unreadCount: 3,
      lastMessageAt: new Date(Date.now() - 5 * 60 * 1000),
      lastMessagePreview: 'Oi, vi o anúncio de vocês. Podem me explicar melhor?',
      tags: ['lead', 'anúncio', 'quente'],
    },
  });

  const chat2 = await prisma.whatsappChat.create({
    data: {
      companyId,
      userId,
      customerPhone: '+5511988776655',
      customerName: 'Fernanda Lima',
      status: 'ACTIVE',
      priority: 'NORMAL',
      unreadCount: 1,
      lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      lastMessagePreview: 'Como faço para integrar com meu CRM?',
      tags: ['suporte', 'integração', 'CRM'],
    },
  });

  const chat3 = await prisma.whatsappChat.create({
    data: {
      companyId,
      userId,
      customerPhone: '+5511977665544',
      customerName: 'Ricardo Souza',
      status: 'ACTIVE',
      priority: 'URGENT',
      unreadCount: 0,
      lastMessageAt: new Date(Date.now() - 30 * 60 * 1000),
      lastMessagePreview: 'Fechado! Vou fazer o pagamento agora.',
      tags: ['venda', 'fechamento', 'pagamento'],
    },
  });

  // ✅ CORRIGIDO: 'WAITING' → 'PENDING'
  const chat4 = await prisma.whatsappChat.create({
    data: {
      companyId,
      userId,
      customerPhone: '+5511966554433',
      customerName: 'Juliana Martins',
      status: 'PENDING',  // ← CORRIGIDO
      priority: 'LOW',
      unreadCount: 0,
      lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      lastMessagePreview: 'Ok, vou analisar a proposta e retorno semana que vem.',
      tags: ['proposta', 'aguardando'],
    },
  });

  const chat5 = await prisma.whatsappChat.create({
    data: {
      companyId,
      userId,
      customerPhone: '+5511955443322',
      customerName: 'Marcos Pereira',
      status: 'RESOLVED',
      priority: 'LOW',
      unreadCount: 0,
      lastMessageAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      lastMessagePreview: 'Perfeito, muito obrigado pelo suporte!',
      tags: ['resolvido', 'suporte'],
    },
  });

  console.log('✅ 5 WhatsApp chats inseridos\n');

  // 4. Inserir mensagens de exemplo
  // ✅ CORRIGIDO: 'messageType' → 'type' e removido 'companyId'
  console.log('💬 Inserindo mensagens de exemplo...');

  await prisma.whatsappMessage.createMany({
    data: [
      {
        chatId: chat1.id,
        direction: 'INCOMING',
        content: 'Oi, vi o anúncio de vocês no Instagram',
        type: 'TEXT',
        status: 'DELIVERED',
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
      {
        chatId: chat1.id,
        direction: 'OUTGOING',
        content: 'Olá Roberto! Que bom que nos encontrou. Como posso ajudar?',
        type: 'TEXT',
        status: 'READ',
        createdAt: new Date(Date.now() - 55 * 60 * 1000),
      },
      {
        chatId: chat1.id,
        direction: 'INCOMING',
        content: 'Quero saber mais sobre a plataforma de IA para vendas',
        type: 'TEXT',
        status: 'DELIVERED',
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        chatId: chat1.id,
        direction: 'INCOMING',
        content: 'Oi, vi o anúncio de vocês. Podem me explicar melhor?',
        type: 'TEXT',
        status: 'DELIVERED',
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      },
      {
        chatId: chat2.id,
        direction: 'INCOMING',
        content: 'Boa tarde!',
        type: 'TEXT',
        status: 'READ',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
      {
        chatId: chat2.id,
        direction: 'OUTGOING',
        content: 'Boa tarde Fernanda! Tudo bem?',
        type: 'TEXT',
        status: 'READ',
        createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
      },
      {
        chatId: chat2.id,
        direction: 'INCOMING',
        content: 'Como faço para integrar com meu CRM?',
        type: 'TEXT',
        status: 'DELIVERED',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        chatId: chat3.id,
        direction: 'OUTGOING',
        content: 'Ricardo, temos uma condição especial válida só até hoje!',
        type: 'TEXT',
        status: 'READ',
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
      {
        chatId: chat3.id,
        direction: 'INCOMING',
        content: 'Qual seria?',
        type: 'TEXT',
        status: 'READ',
        createdAt: new Date(Date.now() - 45 * 60 * 1000),
      },
      {
        chatId: chat3.id,
        direction: 'OUTGOING',
        content: '20% de desconto no plano anual!',
        type: 'TEXT',
        status: 'READ',
        createdAt: new Date(Date.now() - 40 * 60 * 1000),
      },
      {
        chatId: chat3.id,
        direction: 'INCOMING',
        content: 'Fechado! Vou fazer o pagamento agora.',
        type: 'TEXT',
        status: 'READ',
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    ],
  });

  console.log('✅ Mensagens inseridas\n');

  // 5. Resumo final
  const totalCalls = await prisma.call.count({ where: { companyId } });
  const totalChats = await prisma.whatsappChat.count({ where: { companyId } });
  const totalMessages = await prisma.whatsappMessage.count({ 
    where: { chat: { companyId } } 
  });

  console.log('═══════════════════════════════════════');
  console.log('📊 RESUMO DOS DADOS INSERIDOS');
  console.log('═══════════════════════════════════════');
  console.log(`📞 Calls: ${totalCalls}`);
  console.log(`💬 WhatsApp Chats: ${totalChats}`);
  console.log(`📝 WhatsApp Messages: ${totalMessages}`);
  console.log('═══════════════════════════════════════');
  console.log('\n✅ Seed concluído com sucesso!');
  console.log('🔄 Atualize o dashboard no frontend para ver os dados.');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
