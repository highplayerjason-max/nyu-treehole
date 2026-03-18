import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/auth/verify-email?token=xxx
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/verify-email?error=missing", req.url)
    );
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record) {
    return NextResponse.redirect(
      new URL("/verify-email?error=invalid", req.url)
    );
  }

  if (record.expiresAt < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    return NextResponse.redirect(
      new URL("/verify-email?error=expired", req.url)
    );
  }

  // Mark user as verified and clean up token
  await prisma.user.update({
    where: { id: record.userId },
    data: { emailVerified: true },
  });
  await prisma.verificationToken.delete({ where: { token } });

  return NextResponse.redirect(new URL("/verify-email?success=1", req.url));
}
