import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  // Prevent self-demotion
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "不能修改自己的权限" },
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
