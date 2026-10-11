// Script to reset password for demo account using the exact same hashing
// method that Better Auth uses internally (scrypt via @noble/hashes)
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// These are the exact config values from Better Auth's crypto/password.ts
const config = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64,
};

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password) {
  // Generate a random 16-byte salt encoded as hex (matches Better Auth's implementation)
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = bytesToHex(saltBytes);

  const key = await scryptAsync(password.normalize("NFKC"), salt, {
    N: config.N,
    p: config.p,
    r: config.r,
    dkLen: config.dkLen,
    maxmem: 128 * config.N * config.r * 2,
  });

  return `${salt}:${bytesToHex(key)}`;
}

const email = "ladyvply38@yahoo.com";
const newPassword = "HOUSECUTSvb12";

console.log(`Resetting password for ${email}...`);

const user = await prisma.user.findFirst({ where: { email } });
if (!user) {
  console.error("User not found!");
  process.exit(1);
}

console.log(`Found user: ${user.name} (${user.id})`);

const hashedPassword = await hashPassword(newPassword);
console.log(`Generated new hash: ${hashedPassword.substring(0, 30)}...`);

const updated = await prisma.account.updateMany({
  where: {
    userId: user.id,
    providerId: "credential",
  },
  data: {
    password: hashedPassword,
  },
});

console.log(`Updated ${updated.count} account(s)`);
await prisma.$disconnect();
console.log("Done!");
