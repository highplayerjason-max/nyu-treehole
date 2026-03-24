import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ContentStatus } from "@prisma/client";

export async function GET() {
  const tags = await prisma.tag.findMany({
    select: {
      name: true,
      articles: {
        where: {
          article: { status: ContentStatus.PUBLISHED, isDraft: false },
        },
        select: { articleId: true },
      },
    },
  });

  const ranked = tags
    .map((t) => ({ name: t.name, count: t.articles.length }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return NextResponse.json(ranked);
}
