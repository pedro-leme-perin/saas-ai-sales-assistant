import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  const users = await prisma.user.findMany();
  
  console.log('=== USUÁRIOS NO BANCO ===');
  console.log('Total:', users.length);
  
  users.forEach(user => {
    console.log('\n---');
    console.log('Email:', user.email);
    console.log('Clerk ID:', user.clerkId);
    console.log('Company ID:', user.companyId);
  });
}

checkUsers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });