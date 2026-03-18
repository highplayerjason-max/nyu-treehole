import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ContentStatus } from "@prisma/client";

export async function GET() {
  // Only surface non-banned hashtags; count only PUBLISHED posts
  const hashtags = await prisma.hashtag.findMany({
    where: { isBanned: false },
    select: {
      name: true,
      posts: {
        where: { post: { status: ContentStatus.PUBLISHED } },
        select: { postId: true },
      },
    },
  });

  const ranked = hashtags
    .map((h) => ({ name: h.name, count: h.posts.length }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return NextResponse.json(ranked);
}
