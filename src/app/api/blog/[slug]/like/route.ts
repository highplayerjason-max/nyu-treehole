import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContentStatus } from "@prisma/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { slug } = await params;
  const article = await prisma.blogArticle.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });

  if (!article || article.status !== ContentStatus.PUBLISHED) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.like.findUnique({
      where: {
        userId_articleId: { userId: session.user.id, articleId: article.id },
      },
    });

    let liked: boolean;
    if (existing) {
      await tx.like.delete({ where: { id: existing.id } });
      liked = false;
    } else {
      await tx.like.create({
        data: { userId: session.user.id, articleId: article.id },
      });
      liked = true;
    }

    const count = await tx.like.count({ where: { articleId: article.id } });
    return { liked, count };
  });

  return NextResponse.json(result);
}
