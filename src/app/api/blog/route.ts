import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blogArticleSchema } from "@/lib/validators";
import { checkContent } from "@/lib/moderation";
import { isRateLimited } from "@/lib/rate-limit";
import { ContentStatus } from "@prisma/client";
import slugify from "slugify";

// GET /api/blog - List articles
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 12;
  const search = searchParams.get("search") || "";
  const tag = searchParams.get("tag") || "";
  const authorId = searchParams.get("author") || "";

  const where = {
    status: ContentStatus.PUBLISHED,
    isDraft: false,
    ...(search
      ? { title: { contains: search, mode: "insensitive" as const } }
      : {}),
    ...(tag
      ? { tags: { some: { tag: { name: tag } } } }
      : {}),
    ...(authorId ? { authorId } : {}),
  };

  const [articles, total] = await Promise.all([
    prisma.blogArticle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        author: { select: { id: true, displayName: true } },
        tags: { include: { tag: true } },
        series: { select: { id: true, title: true } },
        _count: { select: { likes: true } },
      },
    }),
    prisma.blogArticle.count({ where }),
  ]);

  return NextResponse.json({
    articles,
    total,
    pages: Math.ceil(total / limit),
    page,
  });
}

// POST /api/blog - Create article
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  // Rate limit: 1 post/comment/article per minute
  if (await isRateLimited(session.user.id)) {
    return NextResponse.json(
      { error: "发布太频繁了，请稍等一分钟再试" },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = blogArticleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { title, content, excerpt, coverImage, isDraft, tags, seriesId, seriesOrder } =
      parsed.data;

    // Generate unique slug
    let slug = slugify(title, { lower: true, strict: true });
    if (!slug) slug = `post-${Date.now()}`;

    const existing = await prisma.blogArticle.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Moderation check (only for published content)
    let status: (typeof ContentStatus)[keyof typeof ContentStatus] = ContentStatus.PUBLISHED;
    if (!isDraft) {
      const modResult = await checkContent(`${title}\n${content}`);
      if (modResult.flagged) {
        status = ContentStatus.FLAGGED;
      }
    }

    // Upsert tags
    const tagRecords = await Promise.all(
      tags.map((name) =>
        prisma.tag.upsert({
          where: { name },
          update: {},
          create: { name },
        })
      )
    );

    const article = await prisma.blogArticle.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt || content.replace(/<[^>]*>/g, "").slice(0, 200),
        coverImage: coverImage || null,
        isDraft,
        status: isDraft ? ContentStatus.PUBLISHED : status,
        authorId: session.user.id,
        seriesId: seriesId || null,
        seriesOrder: seriesOrder || null,
        tags: {
          create: tagRecords.map((t) => ({ tagId: t.id })),
        },
      },
      include: {
        author: { select: { id: true, displayName: true } },
        tags: { include: { tag: true } },
      },
    });

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    console.error("Create article error:", error);
    return NextResponse.json(
      { error: "发布失败，请稍后重试" },
      { status: 500 }
    );
  }
}
