import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContentStatus } from "@prisma/client";

// GET /api/admin/tags - list all hashtags with stats
export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const filter = searchParams.get("filter") || "all"; // all | active | banned

  const hashtags = await prisma.hashtag.findMany({
    where: {
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(filter === "banned" ? { isBanned: true } : {}),
      ...(filter === "active" ? { isBanned: false } : {}),
    },
    orderBy: { posts: { _count: "desc" } },
    select: {
      id: true,
      name: true,
      isBanned: true,
      _count: { select: { posts: true } },
    },
  });

  // Count only published posts per hashtag
  const withPublishedCount = await Promise.all(
    hashtags.map(async (h) => {
      const publishedCount = await prisma.hashtagOnPost.count({
        where: {
          hashtagId: h.id,
          post: { status: ContentStatus.PUBLISHED },
        },
      });
      return { ...h, publishedCount };
    })
  );

  return NextResponse.json({ hashtags: withPublishedCount });
}
