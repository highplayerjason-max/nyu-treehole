import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/blog/[slug]/tags/[tagId] - Remove a tag from an article (author or admin)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; tagId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { slug, tagId } = await params;
  const article = await prisma.blogArticle.findUnique({
    where: { slug },
    select: { id: true, authorId: true },
  });

  if (!article) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  if (article.authorId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限删除标签" }, { status: 403 });
  }

  const relation = await prisma.tagOnArticle.findUnique({
    where: {
      articleId_tagId: {
        articleId: article.id,
        tagId,
      },
    },
  });

  if (!relation) {
    return NextResponse.json({ error: "标签不存在" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.tagOnArticle.delete({
      where: {
        articleId_tagId: {
          articleId: article.id,
          tagId,
        },
      },
    });

    const remainingRelations = await tx.tagOnArticle.count({
      where: { tagId },
    });

    if (remainingRelations === 0) {
      await tx.tag.delete({ where: { id: tagId } });
    }
  });

  return NextResponse.json({ message: "标签已删除" });
}
