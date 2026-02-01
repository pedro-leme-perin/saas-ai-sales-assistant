import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixUser() {
  const clerkId = 'user_38DBuAE853dYfV0gOuswEf8MzHa';
  const email = 'leme.baseapr@gmail.com';

  // Find company
  const company = await prisma.company.findFirst();
  if (!company) {
    console.error('❌ Nenhuma empresa encontrada');
    return;
  }

  // Check if user exists
  const existing = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (existing) {
    console.log('✅ Usuário já existe:', existing.email);
    return;
  }

  // Create user
  const user = await prisma.user.create({
    data: {
      clerkId,
      email,
      name: 'Pedro Perin',
      role: 'OWNER',
      companyId: company.id,
    },
  });

  console.log('✅ Usuário criado:', user.email);
  console.log('🏢 Empresa:', company.name);
  console.log('🔑 Clerk ID:', clerkId);
}

fixUser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });