import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportSchema } from "@/lib/validators";
import { ContentStatus } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id: postId } = await params;

  const post = await prisma.treeholePost.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }

  // Check if already reported by this user
  const existing = await prisma.report.findFirst({
    where: { postId, reporterId: session.user.id },
  });
  if (existing) {
    return NextResponse.json({ error: "你已经举报过了" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = reportSchema.safeParse(body);

    await prisma.report.create({
      data: {
        contentType: "TREEHOLE_POST",
        reporterId: session.user.id,
        postId,
        reason: parsed.success ? parsed.data.reason : undefined,
      },
    });

    // Count total reports for this post
    const reportCount = await prisma.report.count({ where: { postId } });

    // Auto-flag if 3+ reports
    if (reportCount >= 3 && post.status === ContentStatus.PUBLISHED) {
      await prisma.treeholePost.update({
        where: { id: postId },
        data: { status: ContentStatus.FLAGGED },
      });
    }

    return NextResponse.json({ message: "举报成功", reportCount });
  } catch (error) {
    console.error("Report error:", error);
    return NextResponse.json(
      { error: "举报失败，请稍后重试" },
      { status: 500 }
    );
  }
}
