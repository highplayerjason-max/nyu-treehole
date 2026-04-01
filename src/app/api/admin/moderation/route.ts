import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContentType, ModerationCaseStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "all";

  const contentTypeFilter: ContentType[] =
    type === "post"
      ? [ContentType.TREEHOLE_POST]
      : type === "comment"
      ? [ContentType.TREEHOLE_COMMENT]
      : type === "article"
      ? [ContentType.BLOG_ARTICLE]
      : [
          ContentType.TREEHOLE_POST,
          ContentType.TREEHOLE_COMMENT,
          ContentType.BLOG_ARTICLE,
        ];

  const cases = await prisma.moderationCase.findMany({
    where: {
      status: ModerationCaseStatus.OPEN,
      contentType: {
        in: contentTypeFilter,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const items: Array<{
    id: string;
    type: string;
    board: string | null;
    source: string;
    reason: string | null;
    reportCount: number;
    content: string;
    imageUrl: string | null;
    author: { displayName: string; email: string };
    status: string;
    createdAt: Date;
  }> = [];

  for (const entry of cases) {
    if (entry.contentType === "TREEHOLE_POST") {
      const post = await prisma.treeholePost.findUnique({
        where: { id: entry.contentId },
        include: {
          author: { select: { displayName: true, email: true } },
        },
      });

      if (!post || post.status === "DELETED") continue;

      items.push({
        id: post.id,
        type: entry.contentType,
        board: post.board,
        source: entry.source,
        reason: entry.reason,
        reportCount: entry.reportCount,
        content: post.content,
        imageUrl: post.imageUrl,
        author: post.author,
        status: post.status,
        createdAt: post.createdAt,
      });
      continue;
    }

    if (entry.contentType === "TREEHOLE_COMMENT") {
      const comment = await prisma.treeholeComment.findUnique({
        where: { id: entry.contentId },
        include: {
          author: { select: { displayName: true, email: true } },
          post: { select: { board: true } },
        },
      });

      if (!comment || comment.status === "DELETED") continue;

      items.push({
        id: comment.id,
        type: entry.contentType,
        board: comment.post.board,
        source: entry.source,
        reason: entry.reason,
        reportCount: entry.reportCount,
        content: comment.content,
        imageUrl: comment.imageUrl,
        author: comment.author,
        status: comment.status,
        createdAt: comment.createdAt,
      });
      continue;
    }

    const article = await prisma.blogArticle.findUnique({
      where: { id: entry.contentId },
      include: {
        author: { select: { displayName: true, email: true } },
      },
    });

    if (!article || article.status === "DELETED") continue;

    items.push({
      id: article.id,
      type: entry.contentType,
      board: null,
      source: entry.source,
      reason: entry.reason,
      reportCount: entry.reportCount,
      content: `[${article.title}] ${article.content.replace(/<[^>]*>/g, "").slice(0, 200)}`,
      imageUrl: article.coverImage,
      author: article.author,
      status: article.status,
      createdAt: article.createdAt,
    });
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return NextResponse.json({ items, total: items.length });
}
