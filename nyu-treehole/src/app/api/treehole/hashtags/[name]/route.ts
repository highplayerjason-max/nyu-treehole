import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/treehole/hashtags/[name] - Delete a hashtag globally (admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { name } = await params;
  const hashtag = await prisma.hashtag.findUnique({
    where: { name: decodeURIComponent(name) },
    select: { id: true, name: true },
  });

  if (!hashtag) {
    return NextResponse.json({ error: "标签不存在" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.hashtagOnPost.deleteMany({
      where: { hashtagId: hashtag.id },
    });

    await tx.hashtag.delete({
      where: { id: hashtag.id },
    });
  });

  return NextResponse.json({ message: "标签已删除", hashtag: hashtag.name });
}
