import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";
import {
  buildEmailVerificationUrl,
  getEmailVerificationExpiryHours,
  issueEmailVerificationToken,
} from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    // email is already normalized (trim + lowercase) by the Zod schema
    const { email, password, displayName } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);
    const baseUrl = process.env.AUTH_URL || req.nextUrl.origin;

    const { user, token, created } = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });

      if (existing?.emailVerified) {
        throw new Error("EMAIL_ALREADY_REGISTERED");
      }

      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              passwordHash,
              displayName,
            },
          })
        : await tx.user.create({
            data: {
              email,
              passwordHash,
              displayName,
              emailVerified: false,
            },
          });

      const { token } = await issueEmailVerificationToken(tx, user.id);

      return {
        user,
        token,
        created: !existing,
      };
    });

    const verificationUrl = buildEmailVerificationUrl(baseUrl, token);
    await sendVerificationEmail({
      to: user.email,
      displayName: user.displayName,
      verificationUrl,
      expiresInHours: getEmailVerificationExpiryHours(),
    });

    return NextResponse.json(
      {
        message: "验证邮件已发送，请查收邮箱并点击链接完成验证",
        userId: user.id,
        email: user.email,
      },
      { status: created ? 201 : 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_REGISTERED") {
      return NextResponse.json(
        { error: "该邮箱已被注册" },
        { status: 400 }
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 }
    );
  }
}
