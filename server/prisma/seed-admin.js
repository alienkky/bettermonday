/**
 * Admin seed script
 * Usage: node prisma/seed-admin.js [email] [password]
 * Default: admin@bettermonday.kr / changeme123!
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'admin@bettermonday.kr';
  const password = process.argv[3] || 'changeme123!';
  const name = process.argv[4] || '관리자';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`⚠️  Admin already exists: ${email}`);
    console.log('   To reset password, use: node prisma/seed-admin.js <email> <newpassword>');
    if (process.argv[3]) {
      const hash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { email },
        data: { passwordHash: hash, forcePasswordChange: false },
      });
      console.log('✅ Password updated.');
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: {
      role: 'admin',
      name,
      email,
      passwordHash,
      forcePasswordChange: true, // force change on first login
      isActive: true,
    },
  });

  console.log('✅ Admin created:');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   ID: ${admin.id}`);
  console.log('⚠️  Please change the password on first login!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
