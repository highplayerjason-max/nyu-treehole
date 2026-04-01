import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openModerationCase } from "@/lib/community";
import { ModerationCaseSource } from "@prisma/client";

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

  const existing = await prisma.report.findFirst({
    where: { articleId: article.id, reporterId: session.user.id },
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
          contentType: "BLOG_ARTICLE",
          reporterId: session.user.id,
          articleId: article.id,
          reason,
        },
      });

      const count = await tx.report.count({
        where: { articleId: article.id },
      });

      await openModerationCase(tx, {
        contentType: "BLOG_ARTICLE",
        contentId: article.id,
        source: ModerationCaseSource.REPORT,
        reason,
        incrementReportCount: true,
      });

      return count;
    });

    return NextResponse.json({ message: "举报成功", reportCount });
  } catch (error) {
    console.error("Report blog article error:", error);
    return NextResponse.json({ error: "举报失败" }, { status: 500 });
  }
}
