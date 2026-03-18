import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

// POST /api/auth/resend-verification  body: { email }
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "请提供邮箱" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return 200 to prevent email enumeration
    if (!user || user.emailVerified) {
      return NextResponse.json({ message: "如果邮箱存在且未验证，验证邮件已发送" });
    }

    // Rate limit: no more than 1 token per 2 minutes
    const recent = await prisma.verificationToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: new Date(Date.now() - 2 * 60 * 1000) },
      },
    });
    if (recent) {
      return NextResponse.json(
        { error: "请稍等片刻再重新发送" },
        { status: 429 }
      );
    }

    // Delete old tokens for this user
    await prisma.verificationToken.deleteMany({ where: { userId: user.id } });

    const token = crypto.randomBytes(32).toString("hex");
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await sendVerificationEmail(user.email, user.displayName, token);

    return NextResponse.json({ message: "验证邮件已发送" });
  } catch (err) {
    console.error("Resend verification error:", err);
    return NextResponse.json({ error: "发送失败，请稍后重试" }, { status: 500 });
  }
}
