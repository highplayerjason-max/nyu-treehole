import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canChangeDisplayName } from "@/lib/display-name";
import { updateDisplayNameSchema } from "@/lib/validators";

function toResponsePayload(user: {
  displayName: string;
  displayNameChangedAt: Date | null;
}) {
  const { nextAllowedAt } = canChangeDisplayName(user.displayNameChangedAt);

  return {
    displayName: user.displayName,
    nextAllowedAt: nextAllowedAt?.toISOString() ?? null,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Please log in first", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      displayName: true,
      displayNameChangedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found", code: "USER_NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json(toResponsePayload(user));
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Please log in first", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateDisplayNameSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0].message,
          code: "INVALID_DISPLAY_NAME",
        },
        { status: 400 }
      );
    }

    const nextDisplayName = parsed.data.displayName;
    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        displayName: true,
        displayNameChangedAt: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found", code: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (existingUser.displayName === nextDisplayName) {
      return NextResponse.json(
        {
          error: "Display name is unchanged",
          code: "DISPLAY_NAME_UNCHANGED",
          ...toResponsePayload(existingUser),
        },
        { status: 400 }
      );
    }

    const { allowed, nextAllowedAt } = canChangeDisplayName(
      existingUser.displayNameChangedAt
    );

    if (!allowed) {
      return NextResponse.json(
        {
          error: "Display name can only be changed once every 24 hours",
          code: "DISPLAY_NAME_COOLDOWN",
          nextAllowedAt: nextAllowedAt?.toISOString() ?? null,
        },
        { status: 429 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        displayName: nextDisplayName,
        displayNameChangedAt: new Date(),
      },
      select: {
        displayName: true,
        displayNameChangedAt: true,
      },
    });

    return NextResponse.json({
      ...toResponsePayload(updatedUser),
      message: "Display name updated",
    });
  } catch (error) {
    console.error("Update display name error:", error);
    return NextResponse.json(
      { error: "Failed to update display name", code: "UPDATE_FAILED" },
      { status: 500 }
    );
  }
}
