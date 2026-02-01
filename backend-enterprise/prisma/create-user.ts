import { PrismaClient, UserRole, Plan } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Pegar o Clerk ID do log (user_38DBuAE853dYfV0gOuswEf8MzHa)
  const clerkId = 'user_38DBuAE853dYfV0gOuswEf8MzHa';
  const email = 'leme.baseapr@gmail.com'; // ou 'pedroperin@yahoo.com.br'
  const name = 'Pedro Perin';

  console.log('🔍 Buscando ou criando empresa...');
  
  // Buscar empresa existente
  let company = await prisma.company.findFirst();
  
  if (!company) {
    console.log('📦 Criando empresa...');
    company = await prisma.company.create({
      data: {
        name: 'Minha Empresa',
        plan: Plan.PROFESSIONAL,
      },
    });
  }

  console.log(`✅ Empresa: ${company.name} (${company.id})`);

  // Verificar se usuário já existe
  const existingUser = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (existingUser) {
    console.log('✅ Usuário já existe:', existingUser.email);
    return;
  }

  // Criar usuário
  console.log('👤 Criando usuário...');
  const user = await prisma.user.create({
    data: {
      clerkId,
      email,
      name,
      role: UserRole.ADMIN,
      companyId: company.id,
    },
  });

  console.log('✅ Usuário criado:', user.email);
  console.log('🎉 SUCESSO! Agora você pode fazer login!');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });