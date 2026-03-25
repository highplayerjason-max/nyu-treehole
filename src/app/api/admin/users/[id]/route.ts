import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteUserAccount, UserNotFoundError } from "@/lib/user-deletion";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot change your own admin role here." },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (typeof body.isBanned === "boolean") updateData.isBanned = body.isBanned;
  if (body.role === "USER" || body.role === "ADMIN") updateData.role = body.role;

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      isBanned: true,
    },
  });

  return NextResponse.json(user);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await deleteUserAccount(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.error("Admin delete user error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
