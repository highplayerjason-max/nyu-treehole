import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blogArticleSchema } from "@/lib/validators";
import { ContentStatus } from "@prisma/client";

// GET /api/blog/[slug]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  const viewerId = session?.user?.id;
  const { slug } = await params;

  const article = await prisma.blogArticle.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, displayName: true } },
      tags: { include: { tag: true } },
      series: {
        include: {
          articles: {
            where: { status: ContentStatus.PUBLISHED, isDraft: false },
            orderBy: { seriesOrder: "asc" },
            select: { id: true, title: true, slug: true, seriesOrder: true },
          },
        },
      },
      ...(viewerId
        ? {
            likes: {
              where: { userId: viewerId },
              select: { id: true },
              take: 1,
            },
          }
        : {}),
      _count: { select: { likes: true } },
    },
  });

  if (!article || article.status === ContentStatus.DELETED) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  const response = {
    ...article,
    likedByMe: "likes" in article ? article.likes.length > 0 : false,
    ...("likes" in article ? { likes: undefined } : {}),
  };

  return NextResponse.json(response);
}

// PUT /api/blog/[slug]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { slug } = await params;
  const article = await prisma.blogArticle.findUnique({ where: { slug } });

  if (!article) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  if (article.authorId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限编辑" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = blogArticleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { title, content, excerpt, coverImage, isDraft, tags, seriesId, seriesOrder } =
      parsed.data;

    // Remove old tags, add new ones
    await prisma.tagOnArticle.deleteMany({ where: { articleId: article.id } });

    const tagRecords = await Promise.all(
      tags.map((name) =>
        prisma.tag.upsert({
          where: { name },
          update: {},
          create: { name },
        })
      )
    );

    const updated = await prisma.blogArticle.update({
      where: { slug },
      data: {
        title,
        content,
        excerpt: excerpt || content.replace(/<[^>]*>/g, "").slice(0, 200),
        coverImage: coverImage || null,
        isDraft,
        seriesId: seriesId || null,
        seriesOrder: seriesOrder || null,
        tags: {
          create: tagRecords.map((t) => ({ tagId: t.id })),
        },
      },
      include: {
        author: { select: { id: true, displayName: true } },
        tags: { include: { tag: true } },
      },
    });

    return NextResponse.json({ article: updated });
  } catch (error) {
    console.error("Update article error:", error);
    return NextResponse.json(
      { error: "更新失败" },
      { status: 500 }
    );
  }
}

// DELETE /api/blog/[slug]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { slug } = await params;
  const article = await prisma.blogArticle.findUnique({ where: { slug } });

  if (!article) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  if (article.authorId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限删除" }, { status: 403 });
  }

  await prisma.blogArticle.update({
    where: { slug },
    data: { status: ContentStatus.DELETED },
  });

  return NextResponse.json({ message: "已删除" });
}
