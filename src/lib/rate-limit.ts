import { prisma } from "./prisma";

/**
 * Returns true if the user has posted/commented anything in the last minute.
 * Checks treehole posts, treehole comments, and blog articles.
 */
export async function isRateLimited(userId: string): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

  const [recentPost, recentComment, recentArticle] = await Promise.all([
    prisma.treeholePost.findFirst({
      where: { authorId: userId, createdAt: { gte: oneMinuteAgo } },
      select: { id: true },
    }),
    prisma.treeholeComment.findFirst({
      where: { authorId: userId, createdAt: { gte: oneMinuteAgo } },
      select: { id: true },
    }),
    prisma.blogArticle.findFirst({
      where: { authorId: userId, createdAt: { gte: oneMinuteAgo } },
      select: { id: true },
    }),
  ]);

  return !!(recentPost || recentComment || recentArticle);
}
