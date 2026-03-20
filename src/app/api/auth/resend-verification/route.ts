import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resendVerificationSchema } from "@/lib/validators";
import {
  buildEmailVerificationUrl,
  getEmailVerificationExpiryHours,
  issueEmailVerificationToken,
} from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resendVerificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "未找到该账号" },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "该邮箱已完成验证，可直接登录" },
        { status: 400 }
      );
    }

    const { token } = await issueEmailVerificationToken(prisma, user.id);
    const verificationUrl = buildEmailVerificationUrl(
      process.env.AUTH_URL || req.nextUrl.origin,
      token
    );

    await sendVerificationEmail({
      to: user.email,
      displayName: user.displayName,
      verificationUrl,
      expiresInHours: getEmailVerificationExpiryHours(),
    });

    return NextResponse.json({
      message: "验证邮件已重新发送，请查收邮箱",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "重发失败，请稍后重试" },
      { status: 500 }
    );
  }
}
