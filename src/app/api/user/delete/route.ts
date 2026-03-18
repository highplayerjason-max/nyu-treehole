import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    await prisma.$transaction(async (tx) => {
      // ── 1. Get IDs of content we're about to cascade-delete ──────────────
      const postIds = (
        await tx.treeholePost.findMany({
          where: { authorId: userId },
          select: { id: true },
        })
      ).map((p) => p.id);

      // ── 2. Break self-referential parentId FK on treehole comments ────────
      // Comments on the user's own posts (will be cascade-deleted with the post)
      if (postIds.length > 0) {
        await tx.treeholeComment.updateMany({
          where: { postId: { in: postIds } },
          data: { parentId: null },
        });
      }
      // Replies to the user's own comments (on other people's posts)
      await tx.treeholeComment.updateMany({
        where: { parent: { authorId: userId } },
        data: { parentId: null },
      });

      // ── 3. Delete moderation logs authored by this user ───────────────────
      await tx.moderationLog.deleteMany({ where: { moderatorId: userId } });

      // ── 4. Delete blog comments written by this user ──────────────────────
      await tx.blogComment.deleteMany({ where: { authorId: userId } });

      // ── 5. Delete likes by this user ──────────────────────────────────────
      await tx.like.deleteMany({ where: { userId } });

      // ── 6. Delete reports filed by this user ──────────────────────────────
      await tx.report.deleteMany({ where: { reporterId: userId } });

      // ── 7. Delete the user's treehole comments on other posts ─────────────
      //     (parentId already nullified above, so no FK violation)
      await tx.treeholeComment.deleteMany({ where: { authorId: userId } });

      // ── 8. Delete the user's treehole posts ───────────────────────────────
      //     Cascades: comments on those posts, their likes, reports, hashtags
      await tx.treeholePost.deleteMany({ where: { authorId: userId } });

      // ── 9. Delete blog articles by this user ──────────────────────────────
      //     Cascades: BlogComment, Report, TagOnArticle on those articles
      await tx.blogArticle.deleteMany({ where: { authorId: userId } });

      // ── 10. Delete blog series by this user ───────────────────────────────
      await tx.blogSeries.deleteMany({ where: { authorId: userId } });

      // ── 11. Delete the user ───────────────────────────────────────────────
      //      Cascades: VerificationToken
      await tx.user.delete({ where: { id: userId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "注销失败，请稍后重试" },
      { status: 500 }
    );
  }
}
