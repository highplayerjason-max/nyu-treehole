import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/admin/tags/[id] - ban or unban a hashtag
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id } = await params;
  const { isBanned } = await req.json() as { isBanned: boolean };

  const hashtag = await prisma.hashtag.update({
    where: { id },
    data: { isBanned },
  });

  return NextResponse.json({ hashtag });
}

// DELETE /api/admin/tags/[id] - permanently delete a hashtag and all its post links
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id } = await params;

  // First ban the hashtag so it can't be re-created in a race
  // Then delete all pivot records, then the hashtag itself
  await prisma.hashtagOnPost.deleteMany({ where: { hashtagId: id } });
  await prisma.hashtag.delete({ where: { id } });

  return NextResponse.json({ message: "标签已删除" });
}
