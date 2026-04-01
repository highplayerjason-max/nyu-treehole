import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CommunityBoard, ContentStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scopeParam = searchParams.get("scope");
  const scope =
    scopeParam === "GYM" ? CommunityBoard.GYM : CommunityBoard.TREEHOLE;

  const hashtags = await prisma.hashtag.findMany({
    where: { isBanned: false, scope },
    select: {
      name: true,
      posts: {
        where: {
          post: {
            board: scope,
            status: ContentStatus.PUBLISHED,
          },
        },
        select: { postId: true },
      },
    },
  });

  const ranked = hashtags
    .map((hashtag) => ({ name: hashtag.name, count: hashtag.posts.length }))
    .filter((hashtag) => hashtag.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return NextResponse.json(ranked);
}
