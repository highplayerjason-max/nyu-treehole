import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CommunityBoard, ContentStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const filter = searchParams.get("filter") || "all";
  const scopeParam = searchParams.get("scope") || "treehole";
  const scope =
    scopeParam === "gym" ? CommunityBoard.GYM : CommunityBoard.TREEHOLE;

  const hashtags = await prisma.hashtag.findMany({
    where: {
      scope,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(filter === "banned" ? { isBanned: true } : {}),
      ...(filter === "active" ? { isBanned: false } : {}),
    },
    orderBy: { posts: { _count: "desc" } },
    select: {
      id: true,
      name: true,
      scope: true,
      isBanned: true,
      _count: { select: { posts: true } },
    },
  });

  const withPublishedCount = await Promise.all(
    hashtags.map(async (hashtag) => {
      const publishedCount = await prisma.hashtagOnPost.count({
        where: {
          hashtagId: hashtag.id,
          post: {
            board: scope,
            status: ContentStatus.PUBLISHED,
          },
        },
      });

      return { ...hashtag, publishedCount };
    })
  );

  return NextResponse.json({ hashtags: withPublishedCount });
}
