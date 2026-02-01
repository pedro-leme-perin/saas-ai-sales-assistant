import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateClerkId() {
  const newClerkId = 'user_38DBuAE853dYfV0gOuswEf8MzHa';
  const email = 'leme.baseapr@gmail.com';

  const user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    console.error('❌ Usuário não encontrado');
    return;
  }

  console.log('📝 Clerk ID antigo:', user.clerkId);
  console.log('📝 Clerk ID novo:', newClerkId);

  await prisma.user.update({
    where: { id: user.id },
    data: { clerkId: newClerkId },
  });

  console.log('✅ Clerk ID atualizado!');
}

updateClerkId()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });