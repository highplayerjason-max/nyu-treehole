import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashEmailVerificationToken } from "@/lib/email-verification";
import { getPublicAppUrl } from "@/lib/public-url";

function buildRedirectUrl(
  req: NextRequest,
  path: string,
  params?: Record<string, string>
) {
  const url = new URL(
    path,
    getPublicAppUrl(process.env.AUTH_URL, req.nextUrl.origin)
  );

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      buildRedirectUrl(req, "/verify-email", { status: "invalid" })
    );
  }

  const tokenHash = hashEmailVerificationToken(token);

  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) {
    return NextResponse.redirect(
      buildRedirectUrl(req, "/verify-email", { status: "invalid" })
    );
  }

  if (record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.redirect(
      buildRedirectUrl(req, "/verify-email", {
        status: "expired",
        email: record.user.email,
      })
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    });

    await tx.emailVerificationToken.deleteMany({
      where: { userId: record.userId },
    });
  });

  return NextResponse.redirect(
    buildRedirectUrl(req, "/login", { verified: "true" })
  );
}
