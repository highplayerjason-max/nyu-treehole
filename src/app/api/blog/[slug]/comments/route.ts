import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const blogCommentSchema = z.object({
  content: z.string().min(1, "评论不能为空").max(500, "评论最多500个字符"),
});

// GET /api/blog/[slug]/comments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const article = await prisma.blogArticle.findUnique({ where: { slug } });
  if (!article) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }

  const comments = await prisma.blogComment.findMany({
    where: { articleId: article.id },
    include: {
      author: { select: { id: true, displayName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ comments });
}

// POST /api/blog/[slug]/comments
export async function POST(
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

  try {
    const body = await req.json();
    const parsed = blogCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const comment = await prisma.blogComment.create({
      data: {
        content: parsed.data.content,
        authorId: session.user.id,
        articleId: article.id,
      },
      include: {
        author: { select: { id: true, displayName: true } },
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("Create blog comment error:", error);
    return NextResponse.json({ error: "评论失败" }, { status: 500 });
  }
}
