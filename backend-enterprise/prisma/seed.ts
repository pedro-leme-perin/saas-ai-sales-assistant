import { PrismaClient, UserRole, CallStatus, CallDirection, Plan } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ==========================================
  // 1. CRIAR OU PEGAR COMPANY
  // ==========================================
  console.log('📦 Checking company...');
  
  let company = await prisma.company.findFirst();
  
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Minha Empresa',
        plan: Plan.PROFESSIONAL,
      },
    });
    console.log(`✅ Company created: ${company.name} (${company.plan})`);
  } else {
    console.log(`✅ Company found: ${company.name} (${company.plan})`);
  }
  
  console.log(`   Company ID: ${company.id}\n`);

  // ==========================================
  // 2. ASSOCIAR USUÁRIOS À COMPANY
  // ==========================================
  console.log('👥 Updating users...');
  
  const allUsers = await prisma.user.findMany();
  
  for (const user of allUsers) {
    if (!user.companyId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          companyId: company.id,
          role: UserRole.ADMIN,
        },
      });
      console.log(`✅ User updated: ${user.email} → ${UserRole.ADMIN}`);
    } else {
      console.log(`ℹ️  User already has company: ${user.email}`);
    }
  }

  // ==========================================
  // 3. CRIAR CALLS DE EXEMPLO
  // ==========================================
  console.log('\n📞 Creating example calls...');

  const firstUser = await prisma.user.findFirst({
    where: { companyId: company.id },
  });

  if (!firstUser) {
    console.log('⚠️  No users found. Skipping calls creation.');
  } else {
    // Call 1 - Sucesso
    await prisma.call.create({
      data: {
        phoneNumber: '+5511999999999',
        direction: CallDirection.OUTBOUND,
        duration: 180,
        status: CallStatus.COMPLETED,
        transcript: 'Cliente interessado em nosso produto. Agendada demonstração para próxima semana.',
        sentiment: 0.85,
        userId: firstUser.id,
        companyId: company.id,
      },
    });
    console.log('✅ Call 1 created: +5511999999999 (COMPLETED)');

    // Call 2 - Sucesso
    await prisma.call.create({
      data: {
        phoneNumber: '+5511988888888',
        direction: CallDirection.INBOUND,
        duration: 240,
        status: CallStatus.COMPLETED,
        transcript: 'Cliente solicitou informações sobre preços e condições de pagamento.',
        sentiment: 0.72,
        userId: firstUser.id,
        companyId: company.id,
      },
    });
    console.log('✅ Call 2 created: +5511988888888 (COMPLETED)');

    // Call 3 - Sucesso
    await prisma.call.create({
      data: {
        phoneNumber: '+5511977777777',
        direction: CallDirection.OUTBOUND,
        duration: 120,
        status: CallStatus.COMPLETED,
        transcript: 'Follow-up de proposta enviada. Cliente vai analisar e retornar em 3 dias.',
        sentiment: 0.68,
        userId: firstUser.id,
        companyId: company.id,
      },
    });
    console.log('✅ Call 3 created: +5511977777777 (COMPLETED)');

    // Call 4 - Falha
    await prisma.call.create({
      data: {
        phoneNumber: '+5511966666666',
        direction: CallDirection.OUTBOUND,
        duration: 0,
        status: CallStatus.FAILED,
        transcript: null,
        sentiment: null,
        userId: firstUser.id,
        companyId: company.id,
      },
    });
    console.log('✅ Call 4 created: +5511966666666 (FAILED)');

    // Call 5 - Grande Sucesso
    await prisma.call.create({
      data: {
        phoneNumber: '+5511955555555',
        direction: CallDirection.INBOUND,
        duration: 300,
        status: CallStatus.COMPLETED,
        transcript: 'Cliente fechou contrato! Pedido de 5 licenças do plano Professional.',
        sentiment: 0.95,
        userId: firstUser.id,
        companyId: company.id,
      },
    });
    console.log('✅ Call 5 created: +5511955555555 (COMPLETED)');
  }

  // ==========================================
  // 4. CRIAR WHATSAPP CHATS DE EXEMPLO
  // ==========================================
  console.log('\n💬 Creating WhatsApp chats...');

  if (!firstUser) {
    console.log('⚠️  No users found. Skipping WhatsApp chats creation.');
  } else {
    // WhatsApp Chat 1
    await prisma.whatsappChat.create({
      data: {
        customerPhone: '+5511944444444',
        customerName: 'João Silva',
        userId: firstUser.id,
        companyId: company.id,
      },
    });
    console.log('✅ WhatsApp chat 1 created: João Silva (+5511944444444)');

    // WhatsApp Chat 2
    await prisma.whatsappChat.create({
      data: {
        customerPhone: '+5511933333333',
        customerName: 'Maria Santos',
        userId: firstUser.id,
        companyId: company.id,
      },
    });
    console.log('✅ WhatsApp chat 2 created: Maria Santos (+5511933333333)');
  }

  // ==========================================
  // 5. RESUMO FINAL
  // ==========================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 DATABASE SEED SUMMARY');
  console.log('='.repeat(60));

  const stats = {
    users: await prisma.user.count({ where: { companyId: company.id } }),
    calls: await prisma.call.count({ where: { companyId: company.id } }),
    whatsappChats: await prisma.whatsappChat.count({ where: { companyId: company.id } }),
  };

  console.log(`\n✅ Company: ${company.name}`);
  console.log(`   - ID: ${company.id}`);
  console.log(`   - Plan: ${company.plan}`);
  console.log(`\n✅ Users: ${stats.users}`);
  console.log(`✅ Calls: ${stats.calls}`);
  console.log(`✅ WhatsApp Chats: ${stats.whatsappChats}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 DATABASE SEED COMPLETED SUCCESSFULLY!');
  console.log('='.repeat(60) + '\n');
}

main()
  .catch((error) => {
    console.error('\n' + '='.repeat(60));
    console.error('❌ ERROR DURING SEED');
    console.error('='.repeat(60));
    console.error(error);
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });