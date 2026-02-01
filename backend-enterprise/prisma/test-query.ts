import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testQuery() {
  const clerkId = 'user_38DBuAE853dYfV0gOuswEf8MzHa';
  
  console.log('🔍 Buscando usuário com Clerk ID:', clerkId);
  
  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { company: true },
  });
  
  if (user) {
    console.log('✅ USUÁRIO ENCONTRADO!');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Clerk ID:', user.clerkId);
    console.log('Company ID:', user.companyId);
  } else {
    console.log('❌ USUÁRIO NÃO ENCONTRADO!');
    
    // Tentar buscar de outra forma
    const allUsers = await prisma.user.findMany();
    console.log('\n📋 Todos os usuários:');
    allUsers.forEach(u => {
      console.log('- Email:', u.email, '| Clerk ID:', u.clerkId);
    });
  }
}

testQuery()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });