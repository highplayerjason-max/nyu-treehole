import { NextRequest, NextResponse } from "next/server";
import {
  CommunityBoard,
  ContentStatus,
  ModerationAction,
  ModerationCaseSource,
} from "@prisma/client";
import { auth } from "./auth";
import { checkContent } from "./moderation";
import { prisma } from "./prisma";
import { isRateLimited } from "./rate-limit";
import { deleteUploadedFiles } from "./uploads";
import { treeholeCommentSchema, treeholePostSchema } from "./validators";
import {
  getCommunityBasePath,
  getCommunityContentType,
  openModerationCase,
  resolveModerationCase,
  upsertScopedHashtags,
} from "./community";

function sanitizePostForViewer<
  T extends {
    author: { id: string; displayName: string } | null;
    authorId: string;
    isAnonymous: boolean;
    comments?: Array<{
      author: { id: string; displayName: string } | null;
      authorId?: string;
      isAnonymous: boolean;
    }>;
  },
>(post: T) {
  return {
    ...post,
    author: post.isAnonymous ? null : post.author,
    authorId: post.isAnonymous ? null : post.authorId,
    comments: post.comments?.map((comment) => ({
      ...comment,
      author: comment.isAnonymous ? null : comment.author,
      authorId: comment.isAnonymous ? null : comment.authorId,
    })),
  };
}

async function ensureSignedIn() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "请先登录" }, { status: 401 }),
      session: null,
    };
  }

  return { error: null, session };
}

export async function listCommunityPosts(
  req: NextRequest,
  board: CommunityBoard
) {
  const session = await auth();
  const viewerId = session?.user?.id;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const hashtag = searchParams.get("hashtag");
  const mine = searchParams.get("mine") === "true";
  const commentCountWhere =
    mine && viewerId
      ? { status: { not: ContentStatus.DELETED } }
      : { status: ContentStatus.PUBLISHED };

  const where =
    mine && viewerId
      ? {
          board,
          authorId: viewerId,
          status: { not: ContentStatus.DELETED },
          ...(hashtag
            ? {
                hashtags: {
                  some: {
                    hashtag: {
                      scope: board,
                      name: hashtag,
                    },
                  },
                },
              }
            : {}),
        }
      : {
          board,
          status: ContentStatus.PUBLISHED,
          ...(hashtag
            ? {
                hashtags: {
                  some: {
                    hashtag: {
                      scope: board,
                      name: hashtag,
                    },
                  },
                },
              }
            : {}),
        };

  const posts = await prisma.treeholePost.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, displayName: true } },
      hashtags: {
        where: { hashtag: { scope: board } },
        include: { hashtag: true },
      },
      _count: {
        select: {
          comments: { where: commentCountWhere },
          likes: true,
          reports: true,
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
      comments: {
        where: { status: ContentStatus.PUBLISHED, parentId: null },
        orderBy: { createdAt: "asc" },
        take: 3,
        select: {
          id: true,
          content: true,
          imageUrl: true,
          isAnonymous: true,
          createdAt: true,
          authorId: true,
          author: { select: { id: true, displayName: true } },
        },
      },
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;

  const sanitized = items.map((post) => ({
    ...sanitizePostForViewer(post),
    likedByMe: "likes" in post ? post.likes.length > 0 : false,
    ...("likes" in post ? { likes: undefined } : {}),
  }));

  return NextResponse.json({
    posts: sanitized,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
}

export async function createCommunityPost(
  req: NextRequest,
  board: CommunityBoard
) {
  const { error, session } = await ensureSignedIn();
  if (error || !session) {
    return error;
  }

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
    const moderationResult = await checkContent(content);
    const status = moderationResult.flagged
      ? ContentStatus.FLAGGED
      : ContentStatus.PUBLISHED;

    const post = await prisma.$transaction(async (tx) => {
      const hashtagIds = await upsertScopedHashtags(tx, board, content);

      const created = await tx.treeholePost.create({
        data: {
          content,
          imageUrl: imageUrl || null,
          board,
          isAnonymous,
          status,
          authorId: session.user.id,
          hashtags: {
            create: hashtagIds.map((hashtagId) => ({ hashtagId })),
          },
        },
        include: {
          author: { select: { id: true, displayName: true } },
          hashtags: {
            where: { hashtag: { scope: board } },
            include: { hashtag: true },
          },
          _count: { select: { comments: true, likes: true } },
        },
      });

      if (moderationResult.flagged) {
        await tx.moderationLog.create({
          data: {
            contentType: getCommunityContentType("post"),
            contentId: created.id,
            action: ModerationAction.REJECT,
            reason: moderationResult.reason,
            isAutomatic: true,
          },
        });

        await openModerationCase(tx, {
          contentType: getCommunityContentType("post"),
          contentId: created.id,
          board,
          source: ModerationCaseSource.AI,
          reason: moderationResult.reason,
        });
      }

      return created;
    });

    return NextResponse.json(
      {
        post: {
          ...sanitizePostForViewer(post),
          likedByMe: false,
        },
        flagged: moderationResult.flagged,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create community post error:", error);
    return NextResponse.json(
      { error: "发布失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function getCommunityPost(
  id: string,
  board: CommunityBoard
) {
  const session = await auth();
  const viewerId = session?.user?.id;
  const commentVisibilityWhere =
    viewerId || session?.user?.role === "ADMIN"
      ? { status: { not: ContentStatus.DELETED } }
      : { status: ContentStatus.PUBLISHED };

  const post = await prisma.treeholePost.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, displayName: true } },
      hashtags: {
        where: { hashtag: { scope: board } },
        include: { hashtag: true },
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
      comments: {
        where: commentVisibilityWhere,
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, displayName: true } },
          _count: { select: { reports: true } },
        },
      },
      _count: {
        select: {
          comments: { where: commentVisibilityWhere },
          likes: true,
          reports: true,
        },
      },
    },
  });

  if (!post || post.board !== board || post.status === ContentStatus.DELETED) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }

  if (
    post.status !== ContentStatus.PUBLISHED &&
    viewerId !== post.authorId &&
    session?.user?.role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }

  const sanitized = sanitizePostForViewer(post);

  return NextResponse.json({
    ...sanitized,
    isOwner: viewerId === post.authorId,
    likedByMe: "likes" in post ? post.likes.length > 0 : false,
    comments: sanitized.comments?.map((comment) => ({
      ...comment,
      isOwner: viewerId === comment.authorId,
    })),
    ...("likes" in post ? { likes: undefined } : {}),
  });
}

export async function updateCommunityPost(
  req: NextRequest,
  id: string,
  board: CommunityBoard
) {
  const { error, session } = await ensureSignedIn();
  if (error || !session) {
    return error;
  }

  const existing = await prisma.treeholePost.findUnique({ where: { id } });

  if (!existing || existing.board !== board || existing.status === ContentStatus.DELETED) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }

  if (existing.authorId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限编辑" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = treeholePostSchema.safeParse({
      content: body.content,
      imageUrl: body.imageUrl,
      isAnonymous: existing.isAnonymous,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { content, imageUrl } = parsed.data;
    const moderationResult = await checkContent(content);
    const nextStatus = moderationResult.flagged
      ? ContentStatus.FLAGGED
      : ContentStatus.PUBLISHED;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.hashtagOnPost.deleteMany({ where: { postId: id } });
      const hashtagIds = await upsertScopedHashtags(tx, board, content);

      const post = await tx.treeholePost.update({
        where: { id },
        data: {
          content,
          imageUrl: imageUrl || null,
          status: nextStatus,
          hashtags: {
            create: hashtagIds.map((hashtagId) => ({ hashtagId })),
          },
        },
      });

      if (moderationResult.flagged) {
        await tx.moderationLog.create({
          data: {
            contentType: getCommunityContentType("post"),
            contentId: id,
            action: ModerationAction.REJECT,
            reason: moderationResult.reason,
            isAutomatic: true,
          },
        });

        await openModerationCase(tx, {
          contentType: getCommunityContentType("post"),
          contentId: id,
          board,
          source: ModerationCaseSource.AI,
          reason: moderationResult.reason,
        });
      }

      return post;
    });

    if (existing.imageUrl && existing.imageUrl !== updated.imageUrl) {
      await deleteUploadedFiles([existing.imageUrl]);
    }

    return NextResponse.json({
      post: updated,
      flagged: moderationResult.flagged,
      redirectTo: getCommunityBasePath(board),
    });
  } catch (error) {
    console.error("Update community post error:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function deleteCommunityPost(
  id: string,
  board: CommunityBoard
) {
  const { error, session } = await ensureSignedIn();
  if (error || !session) {
    return error;
  }

  const post = await prisma.treeholePost.findUnique({
    where: { id },
    include: {
      comments: {
        select: { imageUrl: true },
      },
    },
  });

  if (!post || post.board !== board) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }

  if (post.authorId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限删除" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.treeholePost.update({
      where: { id },
      data: { status: ContentStatus.DELETED },
    });

    await resolveModerationCase(tx, {
      contentType: getCommunityContentType("post"),
      contentId: id,
      resolvedById: session.user.id,
    });
  });

  await deleteUploadedFiles([
    post.imageUrl,
    ...post.comments.map((comment) => comment.imageUrl),
  ]);

  return NextResponse.json({ message: "已删除" });
}

export async function createCommunityComment(
  req: NextRequest,
  postId: string,
  board: CommunityBoard
) {
  const { error, session } = await ensureSignedIn();
  if (error || !session) {
    return error;
  }

  if (await isRateLimited(session.user.id)) {
    return NextResponse.json(
      { error: "发布太频繁了，请稍等一分钟再试" },
      { status: 429 }
    );
  }

  const post = await prisma.treeholePost.findUnique({
    where: { id: postId },
    select: { id: true, board: true, status: true },
  });

  if (!post || post.board !== board || post.status !== ContentStatus.PUBLISHED) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = treeholeCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { content, imageUrl, isAnonymous, parentId } = parsed.data;
    const moderationResult = await checkContent(content);
    const status = moderationResult.flagged
      ? ContentStatus.FLAGGED
      : ContentStatus.PUBLISHED;

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.treeholeComment.create({
        data: {
          content,
          imageUrl: imageUrl || null,
          isAnonymous,
          status,
          authorId: session.user.id,
          postId,
          parentId: parentId || null,
        },
        include: {
          author: { select: { id: true, displayName: true } },
        },
      });

      if (moderationResult.flagged) {
        await tx.moderationLog.create({
          data: {
            contentType: getCommunityContentType("comment"),
            contentId: created.id,
            action: ModerationAction.REJECT,
            reason: moderationResult.reason,
            isAutomatic: true,
          },
        });

        await openModerationCase(tx, {
          contentType: getCommunityContentType("comment"),
          contentId: created.id,
          board,
          source: ModerationCaseSource.AI,
          reason: moderationResult.reason,
        });
      }

      return created;
    });

    return NextResponse.json(
      {
        comment: {
          ...comment,
          author: isAnonymous ? null : comment.author,
          authorId: isAnonymous ? null : comment.authorId,
        },
        flagged: moderationResult.flagged,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create community comment error:", error);
    return NextResponse.json({ error: "评论失败，请稍后重试" }, { status: 500 });
  }
}

export async function toggleCommunityPostLike(
  postId: string,
  board: CommunityBoard
) {
  const { error, session } = await ensureSignedIn();
  if (error || !session) {
    return error;
  }

  const post = await prisma.treeholePost.findUnique({
    where: { id: postId },
    select: { id: true, board: true, status: true },
  });

  if (!post || post.board !== board || post.status !== ContentStatus.PUBLISHED) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.like.findUnique({
      where: { userId_postId: { userId: session.user.id, postId } },
    });

    let liked = false;

    if (existing) {
      await tx.like.delete({ where: { id: existing.id } });
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

export async function reportCommunityPost(
  req: NextRequest,
  postId: string,
  board: CommunityBoard
) {
  const { error, session } = await ensureSignedIn();
  if (error || !session) {
    return error;
  }

  const post = await prisma.treeholePost.findUnique({
    where: { id: postId },
    select: { id: true, board: true },
  });

  if (!post || post.board !== board) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }

  const existing = await prisma.report.findFirst({
    where: { postId, reporterId: session.user.id },
  });

  if (existing) {
    return NextResponse.json({ error: "你已经举报过了" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const reason =
      typeof body.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim()
        : undefined;

    const reportCount = await prisma.$transaction(async (tx) => {
      await tx.report.create({
        data: {
          contentType: getCommunityContentType("post"),
          reporterId: session.user.id,
          postId,
          reason,
        },
      });

      const count = await tx.report.count({ where: { postId } });

      await openModerationCase(tx, {
        contentType: getCommunityContentType("post"),
        contentId: postId,
        board,
        source: ModerationCaseSource.REPORT,
        reason,
        incrementReportCount: true,
      });

      return count;
    });

    return NextResponse.json({ message: "举报成功", reportCount });
  } catch (err) {
    console.error("Report community post error:", err);
    return NextResponse.json({ error: "举报失败，请稍后重试" }, { status: 500 });
  }
}

export async function updateCommunityComment(req: NextRequest, commentId: string) {
  const { error, session } = await ensureSignedIn();
  if (error || !session) {
    return error;
  }

  const existing = await prisma.treeholeComment.findUnique({
    where: { id: commentId },
    include: {
      post: {
        select: {
          board: true,
        },
      },
    },
  });

  if (!existing || existing.status === ContentStatus.DELETED) {
    return NextResponse.json({ error: "评论不存在" }, { status: 404 });
  }

  if (existing.authorId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限编辑" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = treeholeCommentSchema.safeParse({
      content: body.content,
      imageUrl: body.imageUrl,
      isAnonymous: existing.isAnonymous,
      parentId: existing.parentId ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { content, imageUrl } = parsed.data;
    const moderationResult = await checkContent(content);
    const nextStatus = moderationResult.flagged
      ? ContentStatus.FLAGGED
      : ContentStatus.PUBLISHED;

    const updated = await prisma.$transaction(async (tx) => {
      const comment = await tx.treeholeComment.update({
        where: { id: commentId },
        data: {
          content,
          imageUrl: imageUrl || null,
          status: nextStatus,
        },
      });

      if (moderationResult.flagged) {
        await tx.moderationLog.create({
          data: {
            contentType: getCommunityContentType("comment"),
            contentId: commentId,
            action: ModerationAction.REJECT,
            reason: moderationResult.reason,
            isAutomatic: true,
          },
        });

        await openModerationCase(tx, {
          contentType: getCommunityContentType("comment"),
          contentId: commentId,
          board: existing.post.board,
          source: ModerationCaseSource.AI,
          reason: moderationResult.reason,
        });
      }

      return comment;
    });

    if (existing.imageUrl && existing.imageUrl !== updated.imageUrl) {
      await deleteUploadedFiles([existing.imageUrl]);
    }

    return NextResponse.json({
      comment: updated,
      flagged: moderationResult.flagged,
    });
  } catch (err) {
    console.error("Update community comment error:", err);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function deleteCommunityComment(commentId: string) {
  const { error, session } = await ensureSignedIn();
  if (error || !session) {
    return error;
  }

  const existing = await prisma.treeholeComment.findUnique({
    where: { id: commentId },
  });

  if (!existing) {
    return NextResponse.json({ error: "评论不存在" }, { status: 404 });
  }

  if (existing.authorId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限删除" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.treeholeComment.update({
      where: { id: commentId },
      data: { status: ContentStatus.DELETED },
    });

    await resolveModerationCase(tx, {
      contentType: getCommunityContentType("comment"),
      contentId: commentId,
      resolvedById: session.user.id,
    });
  });

  await deleteUploadedFiles([existing.imageUrl]);

  return NextResponse.json({ message: "已删除" });
}

export async function reportCommunityComment(
  req: NextRequest,
  commentId: string
) {
  const { error, session } = await ensureSignedIn();
  if (error || !session) {
    return error;
  }

  const comment = await prisma.treeholeComment.findUnique({
    where: { id: commentId },
    include: {
      post: {
        select: {
          board: true,
        },
      },
    },
  });

  if (!comment || comment.status === ContentStatus.DELETED) {
    return NextResponse.json({ error: "评论不存在" }, { status: 404 });
  }

  const existing = await prisma.report.findFirst({
    where: { commentId, reporterId: session.user.id },
  });

  if (existing) {
    return NextResponse.json({ error: "你已经举报过了" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const reason =
      typeof body.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim()
        : undefined;

    const reportCount = await prisma.$transaction(async (tx) => {
      await tx.report.create({
        data: {
          contentType: getCommunityContentType("comment"),
          reporterId: session.user.id,
          commentId,
          reason,
        },
      });

      const count = await tx.report.count({ where: { commentId } });

      await openModerationCase(tx, {
        contentType: getCommunityContentType("comment"),
        contentId: commentId,
        board: comment.post.board,
        source: ModerationCaseSource.REPORT,
        reason,
        incrementReportCount: true,
      });

      return count;
    });

    return NextResponse.json({ message: "举报成功", reportCount });
  } catch (err) {
    console.error("Report community comment error:", err);
    return NextResponse.json({ error: "举报失败，请稍后重试" }, { status: 500 });
  }
}
