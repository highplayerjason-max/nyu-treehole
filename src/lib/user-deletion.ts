import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteUploadedFiles } from "@/lib/uploads";

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = "UserNotFoundError";
  }
}

export async function deleteUserAccount(userId: string) {
  const uploadedFilesToDelete: string[] = [];

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    await collectUploadedFiles(tx, userId, uploadedFilesToDelete);
    await breakCommentParentLinks(tx, userId);

    await tx.moderationLog.deleteMany({ where: { moderatorId: userId } });
    await tx.blogComment.deleteMany({ where: { authorId: userId } });
    await tx.like.deleteMany({ where: { userId } });
    await tx.report.deleteMany({ where: { reporterId: userId } });
    await tx.treeholeComment.deleteMany({ where: { authorId: userId } });
    await tx.treeholePost.deleteMany({ where: { authorId: userId } });
    await tx.blogArticle.deleteMany({ where: { authorId: userId } });
    await tx.blogSeries.deleteMany({ where: { authorId: userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  await deleteUploadedFiles(uploadedFilesToDelete);
}

async function collectUploadedFiles(
  tx: Prisma.TransactionClient,
  userId: string,
  uploadedFilesToDelete: string[]
) {
  const ownPosts = await tx.treeholePost.findMany({
    where: { authorId: userId },
    select: { imageUrl: true },
  });

  const ownArticles = await tx.blogArticle.findMany({
    where: { authorId: userId },
    select: { coverImage: true },
  });

  uploadedFilesToDelete.push(
    ...(ownPosts.map((post) => post.imageUrl).filter(Boolean) as string[]),
    ...(ownArticles
      .map((article) => article.coverImage)
      .filter(Boolean) as string[])
  );
}

async function breakCommentParentLinks(
  tx: Prisma.TransactionClient,
  userId: string
) {
  const ownPosts = await tx.treeholePost.findMany({
    where: { authorId: userId },
    select: { id: true },
  });

  const postIds = ownPosts.map((post) => post.id);

  if (postIds.length > 0) {
    await tx.treeholeComment.updateMany({
      where: { postId: { in: postIds } },
      data: { parentId: null },
    });
  }

  await tx.treeholeComment.updateMany({
    where: { parent: { authorId: userId } },
    data: { parentId: null },
  });
}
