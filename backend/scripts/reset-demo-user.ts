/**
 * Script to reset the demo user password using Better Auth's own hashing.
 * Run from backend/ with: bun run scripts/reset-demo-user.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const EMAIL = "ladyvply38@yahoo.com";
const PASSWORD = "HOUSECUTSvb12";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.log("User not found.");
    process.exit(1);
  }
  console.log(`Found user: ${user.id} (${user.email})`);

  const account = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });

  if (!account) {
    console.log("No credential account found — creating one.");
    const hashed = await hashPassword(PASSWORD);
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: hashed,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log("Credential account created with new password.");
  } else {
    const hashed = await hashPassword(PASSWORD);
    await prisma.account.update({
      where: { id: account.id },
      data: { password: hashed, updatedAt: new Date() },
    });
    console.log("Password updated successfully.");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
