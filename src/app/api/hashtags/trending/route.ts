import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const hashtags = await prisma.hashtag.findMany({
    take: 15,
    orderBy: {
      posts: { _count: "desc" },
    },
    select: {
      name: true,
      _count: { select: { posts: true } },
    },
  });

  return NextResponse.json(
    hashtags.map((h) => ({ name: h.name, count: h._count.posts }))
  );
}
