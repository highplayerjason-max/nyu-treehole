import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContentStatus } from "@prisma/client";

// GET /api/treehole/[id] - Get single post with comments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const viewerId = session?.user?.id;
  const { id } = await params;

  const post = await prisma.treeholePost.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, displayName: true } },
      hashtags: { include: { hashtag: true } },
      ...(viewerId
        ? {
            likes: {
              where: { userId: viewerId },
              select: { id: true },
              take: 1,
            },
          }
        : {}),
      comments: {
        where: { status: ContentStatus.PUBLISHED },
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: { id: true, displayName: true },
          },
        },
      },
      _count: { select: { comments: true, likes: true, reports: true } },
    },
  });

  if (!post || post.status === ContentStatus.DELETED) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }

  // Sanitize anonymous author info
  const sanitizedPost = {
    ...post,
    author: post.isAnonymous ? null : post.author,
    authorId: post.isAnonymous ? null : post.authorId,
    likedByMe: "likes" in post ? post.likes.length > 0 : false,
    comments: post.comments.map((c) => ({
      ...c,
      author: c.isAnonymous ? null : c.author,
      authorId: c.isAnonymous ? null : c.authorId,
    })),
    ...("likes" in post ? { likes: undefined } : {}),
  };

  return NextResponse.json(sanitizedPost);
}

// DELETE /api/treehole/[id] - Delete post (author or admin)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;
  const post = await prisma.treeholePost.findUnique({ where: { id } });

  if (!post) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }

  if (post.authorId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限删除" }, { status: 403 });
  }

  await prisma.treeholePost.update({
    where: { id },
    data: { status: ContentStatus.DELETED },
  });

  return NextResponse.json({ message: "已删除" });
}
