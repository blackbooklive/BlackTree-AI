/**
 * Script to create the Apple App Store demo user account.
 * Uses Better Auth's own scrypt-based password hashing.
 * Run from backend/ with: bun run scripts/create-demo-user.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const EMAIL = "demo@blacktreeai.com";
const PASSWORD = "DemoReview2024!";
const NAME = "Demo User";

const prisma = new PrismaClient();

async function main() {
  console.log(`Creating demo user: ${EMAIL}`);

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });

  let userId: string;

  if (existing) {
    console.log(`User already exists (id: ${existing.id}), updating password...`);
    userId = existing.id;
  } else {
    userId = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        name: NAME,
        email: EMAIL,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log(`User created with id: ${userId}`);
  }

  // Hash password using Better Auth's scrypt
  const hashed = await hashPassword(PASSWORD);

  // Upsert the credential account
  const existingAccount = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
  });

  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { password: hashed, updatedAt: new Date() },
    });
    console.log("Credential account updated with new password.");
  } else {
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashed,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log("Credential account created.");
  }

  // Verify
  const verifiedUser = await prisma.user.findUnique({
    where: { email: EMAIL },
    include: { accounts: true },
  });

  console.log("\n--- Verification ---");
  console.log(`Email:    ${verifiedUser?.email}`);
  console.log(`Name:     ${verifiedUser?.name}`);
  console.log(`Verified: ${verifiedUser?.emailVerified}`);
  console.log(`Accounts: ${verifiedUser?.accounts.map((a) => a.providerId).join(", ")}`);
  console.log("Demo user ready for App Store review.");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
