import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
  const correctClerkId = 'user_38DBuAE853dYfV0gOuswEf8MzH4a';
  const email = 'leme.baseapr@gmail.com';

  const user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    console.error('❌ Usuário não encontrado');
    return;
  }

  console.log('📝 Clerk ID atual:', user.clerkId);
  console.log('📝 Clerk ID correto:', correctClerkId);

  await prisma.user.update({
    where: { id: user.id },
    data: { clerkId: correctClerkId },
  });

  console.log('✅ Clerk ID atualizado!');
}

fix()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });