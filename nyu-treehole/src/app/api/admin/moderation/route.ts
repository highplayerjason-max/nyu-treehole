import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContentStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "all";

  const items: Array<{
    id: string;
    type: string;
    content: string;
    author: { displayName: string; email: string };
    reportCount: number;
    status: string;
    createdAt: Date;
  }> = [];

  // Show content that is FLAGGED or has at least 1 report
  const moderationWhere = {
    OR: [
      { status: ContentStatus.FLAGGED },
      { reports: { some: {} } },
    ],
  };

  if (type === "all" || type === "post") {
    const posts = await prisma.treeholePost.findMany({
      where: { ...moderationWhere, status: { not: ContentStatus.DELETED } },
      include: {
        author: { select: { displayName: true, email: true } },
        _count: { select: { reports: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    posts.forEach((p) =>
      items.push({
        id: p.id,
        type: "TREEHOLE_POST",
        content: p.content,
        author: p.author,
        reportCount: p._count.reports,
        status: p.status,
        createdAt: p.createdAt,
      })
    );
  }

  if (type === "all" || type === "comment") {
    const comments = await prisma.treeholeComment.findMany({
      where: { ...moderationWhere, status: { not: ContentStatus.DELETED } },
      include: {
        author: { select: { displayName: true, email: true } },
        _count: { select: { reports: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    comments.forEach((c) =>
      items.push({
        id: c.id,
        type: "TREEHOLE_COMMENT",
        content: c.content,
        author: c.author,
        reportCount: c._count.reports,
        status: c.status,
        createdAt: c.createdAt,
      })
    );
  }

  if (type === "all" || type === "article") {
    const articles = await prisma.blogArticle.findMany({
      where: { ...moderationWhere, status: { not: ContentStatus.DELETED } },
      include: {
        author: { select: { displayName: true, email: true } },
        _count: { select: { reports: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    articles.forEach((a) =>
      items.push({
        id: a.id,
        type: "BLOG_ARTICLE",
        content: `[${a.title}] ${a.content.replace(/<[^>]*>/g, "").slice(0, 200)}`,
        author: a.author,
        reportCount: a._count.reports,
        status: a.status,
        createdAt: a.createdAt,
      })
    );
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return NextResponse.json({ items, total: items.length });
}
