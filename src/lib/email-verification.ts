import { createHash, randomBytes } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";

const EMAIL_VERIFICATION_TTL_HOURS = 24;

type DbClient = PrismaClient | Prisma.TransactionClient;

export function getEmailVerificationExpiryDate() {
  return new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000);
}

export function getEmailVerificationExpiryHours() {
  return EMAIL_VERIFICATION_TTL_HOURS;
}

export function generateEmailVerificationToken() {
  return randomBytes(32).toString("hex");
}

export function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueEmailVerificationToken(
  db: DbClient,
  userId: string
) {
  const token = generateEmailVerificationToken();
  const tokenHash = hashEmailVerificationToken(token);
  const expiresAt = getEmailVerificationExpiryDate();

  await db.emailVerificationToken.deleteMany({
    where: { userId },
  });

  await db.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export function buildEmailVerificationUrl(baseUrl: string, token: string) {
  const url = new URL("/api/auth/verify-email", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
