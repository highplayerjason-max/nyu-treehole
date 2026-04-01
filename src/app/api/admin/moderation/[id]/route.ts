import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContentStatus, ContentType, ModerationAction } from "@prisma/client";
import { resolveModerationCase } from "@/lib/community";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id } = await params;
  const { action, contentType } = (await req.json()) as {
    action: "APPROVE" | "REJECT" | "DELETE";
    contentType: "TREEHOLE_POST" | "TREEHOLE_COMMENT" | "BLOG_ARTICLE";
  };

  const statusMap: Record<string, ContentStatus> = {
    APPROVE: ContentStatus.PUBLISHED,
    REJECT: ContentStatus.REJECTED,
    DELETE: ContentStatus.DELETED,
  };

  const nextStatus = statusMap[action];
  if (!nextStatus) {
    return NextResponse.json({ error: "无效操作" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (contentType === "TREEHOLE_POST") {
      await tx.treeholePost.update({
        where: { id },
        data: { status: nextStatus },
      });
    } else if (contentType === "TREEHOLE_COMMENT") {
      await tx.treeholeComment.update({
        where: { id },
        data: { status: nextStatus },
      });
    } else if (contentType === "BLOG_ARTICLE") {
      await tx.blogArticle.update({
        where: { id },
        data: { status: nextStatus },
      });
    }

    await resolveModerationCase(tx, {
      contentType: contentType as ContentType,
      contentId: id,
      resolvedById: session.user.id,
    });

    await tx.moderationLog.create({
      data: {
        contentType: contentType as ContentType,
        contentId: id,
        action: action as ModerationAction,
        moderatorId: session.user.id,
        isAutomatic: false,
      },
    });
  });

  return NextResponse.json({ message: "操作成功" });
}
