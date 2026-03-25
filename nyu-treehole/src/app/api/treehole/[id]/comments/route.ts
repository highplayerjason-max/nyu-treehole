import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { treeholeCommentSchema } from "@/lib/validators";
import { checkContent } from "@/lib/moderation";
import { isRateLimited } from "@/lib/rate-limit";
import { ContentStatus } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: postId } = await params;

  const post = await prisma.treeholePost.findUnique({
    where: { id: postId },
  });
  if (!post || post.status !== ContentStatus.PUBLISHED) {
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

    const { content, isAnonymous, parentId } = parsed.data;

    const modResult = await checkContent(content);
    const status = modResult.flagged
      ? ContentStatus.FLAGGED
      : ContentStatus.PUBLISHED;

    const comment = await prisma.treeholeComment.create({
      data: {
        content,
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

    if (modResult.flagged) {
      await prisma.moderationLog.create({
        data: {
          contentType: "TREEHOLE_COMMENT",
          contentId: comment.id,
          action: "REJECT",
          reason: modResult.reason,
          isAutomatic: true,
        },
      });
    }

    return NextResponse.json(
      {
        comment: {
          ...comment,
          author: isAnonymous ? null : comment.author,
          authorId: isAnonymous ? null : comment.authorId,
        },
        flagged: modResult.flagged,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json(
      { error: "评论失败，请稍后重试" },
      { status: 500 }
    );
  }
}
