import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContentStatus } from "@prisma/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id: postId } = await params;
  const post = await prisma.treeholePost.findUnique({
    where: { id: postId },
    select: { id: true, status: true },
  });

  if (!post || post.status !== ContentStatus.PUBLISHED) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.like.findUnique({
      where: { userId_postId: { userId: session.user.id, postId } },
    });

    let liked: boolean;
    if (existing) {
      await tx.like.delete({ where: { id: existing.id } });
      liked = false;
    } else {
      await tx.like.create({
        data: { userId: session.user.id, postId },
      });
      liked = true;
    }

    const count = await tx.like.count({ where: { postId } });
    return { liked, count };
  });

  return NextResponse.json(result);
}
