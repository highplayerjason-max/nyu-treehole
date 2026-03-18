import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { treeholePostSchema } from "@/lib/validators";
import { checkContent } from "@/lib/moderation";
import { isRateLimited } from "@/lib/rate-limit";
import { ContentStatus } from "@prisma/client";

// GET /api/treehole - List posts with cursor-based pagination
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const hashtag = searchParams.get("hashtag");

  const where = {
    status: ContentStatus.PUBLISHED,
    ...(hashtag
      ? { hashtags: { some: { hashtag: { name: hashtag } } } }
      : {}),
  };

  const posts = await prisma.treeholePost.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, displayName: true, avatarUrl: true } },
      hashtags: { include: { hashtag: true } },
      _count: { select: { comments: true, likes: true, reports: true } },
      comments: {
        where: { status: ContentStatus.PUBLISHED, parentId: null },
        orderBy: { createdAt: "asc" },
        take: 3,
        select: {
          id: true,
          content: true,
          isAnonymous: true,
          createdAt: true,
          author: { select: { id: true, displayName: true } },
        },
      },
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;

  // Strip author info for anonymous posts/comments
  const sanitized = items.map((post) => ({
    ...post,
    author: post.isAnonymous ? null : post.author,
    authorId: post.isAnonymous ? null : post.authorId,
    comments: post.comments.map((c) => ({
      ...c,
      author: c.isAnonymous ? null : c.author,
    })),
  }));

  return NextResponse.json({
    posts: sanitized,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
}

// POST /api/treehole - Create a new post
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  // Rate limit: 1 post/comment/article per minute
  if (await isRateLimited(session.user.id)) {
    return NextResponse.json(
      { error: "发布太频繁了，请稍等一分钟再试" },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = treeholePostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { content, isAnonymous, imageUrl } = parsed.data;

    // LLM moderation check
    const modResult = await checkContent(content);
    const status = modResult.flagged
      ? ContentStatus.FLAGGED
      : ContentStatus.PUBLISHED;

    // Extract hashtags
    const hashtagNames = [
      ...new Set(
        (content.match(/#[\w\u4e00-\u9fa5]+/g) || []).map((h: string) =>
          h.slice(1)
        )
      ),
    ];

    // Filter out banned hashtags; allow new ones (upsert) but block existing banned ones
    const allowedHashtagIds: string[] = [];
    for (const name of hashtagNames) {
      const existing = await prisma.hashtag.findUnique({ where: { name } });
      if (existing?.isBanned) continue; // skip banned tags
      const hashtag = await prisma.hashtag.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      allowedHashtagIds.push(hashtag.id);
    }

    const post = await prisma.treeholePost.create({
      data: {
        content,
        imageUrl: imageUrl || null,
        isAnonymous,
        status,
        authorId: session.user.id,
        hashtags: {
          create: allowedHashtagIds.map((hashtagId) => ({ hashtagId })),
        },
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        hashtags: { include: { hashtag: true } },
        _count: { select: { comments: true, likes: true } },
      },
    });

    // Log auto-moderation if flagged
    if (modResult.flagged) {
      await prisma.moderationLog.create({
        data: {
          contentType: "TREEHOLE_POST",
          contentId: post.id,
          action: "REJECT",
          reason: modResult.reason,
          isAutomatic: true,
        },
      });
    }

    return NextResponse.json(
      {
        post: {
          ...post,
          author: isAnonymous ? null : post.author,
          authorId: isAnonymous ? null : post.authorId,
        },
        flagged: modResult.flagged,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create post error:", error);
    return NextResponse.json(
      { error: "发布失败，请稍后重试" },
      { status: 500 }
    );
  }
}
