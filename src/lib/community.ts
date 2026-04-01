import {
  CommunityBoard,
  ContentType,
  ModerationCaseSource,
  ModerationCaseStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "./prisma";

type CommunityDbClient = Prisma.TransactionClient | typeof prisma;

const HASHTAG_REGEX = /#[\w\u4e00-\u9fa5]+/g;

export function getCommunityBasePath(board: CommunityBoard) {
  return board === CommunityBoard.GYM ? "/gym" : "/treehole";
}

export function getCommunityBoardLabel(board: CommunityBoard) {
  return board === CommunityBoard.GYM ? "Gym" : "Treehole";
}

export function getCommunityContentType(kind: "post" | "comment") {
  return kind === "post"
    ? ContentType.TREEHOLE_POST
    : ContentType.TREEHOLE_COMMENT;
}

export function extractHashtagNames(content: string) {
  return [
    ...new Set(
      (content.match(HASHTAG_REGEX) || []).map((tag) => tag.slice(1))
    ),
  ];
}

export async function upsertScopedHashtags(
  db: CommunityDbClient,
  board: CommunityBoard,
  content: string
) {
  const hashtagNames = extractHashtagNames(content);
  const hashtagIds: string[] = [];

  for (const name of hashtagNames) {
    const existing = await db.hashtag.findFirst({
      where: { scope: board, name },
    });

    if (existing?.isBanned) {
      continue;
    }

    const hashtag = await db.hashtag.upsert({
      where: {
        scope_name: {
          scope: board,
          name,
        },
      },
      update: {},
      create: {
        scope: board,
        name,
      },
    });

    hashtagIds.push(hashtag.id);
  }

  return hashtagIds;
}

export async function openModerationCase(
  db: CommunityDbClient,
  args: {
    contentType: ContentType;
    contentId: string;
    board?: CommunityBoard | null;
    source: ModerationCaseSource;
    reason?: string | null;
    incrementReportCount?: boolean;
  }
) {
  const {
    contentType,
    contentId,
    board = null,
    source,
    reason,
    incrementReportCount = false,
  } = args;

  return db.moderationCase.upsert({
    where: {
      contentType_contentId: {
        contentType,
        contentId,
      },
    },
    update: {
      board,
      source,
      status: ModerationCaseStatus.OPEN,
      reason: reason ?? undefined,
      resolvedAt: null,
      resolvedById: null,
      ...(incrementReportCount ? { reportCount: { increment: 1 } } : {}),
    },
    create: {
      contentType,
      contentId,
      board,
      source,
      status: ModerationCaseStatus.OPEN,
      reason: reason ?? null,
      reportCount: incrementReportCount ? 1 : 0,
    },
  });
}

export async function resolveModerationCase(
  db: CommunityDbClient,
  args: {
    contentType: ContentType;
    contentId: string;
    resolvedById: string;
  }
) {
  const { contentType, contentId, resolvedById } = args;

  await db.moderationCase.updateMany({
    where: {
      contentType,
      contentId,
    },
    data: {
      status: ModerationCaseStatus.RESOLVED,
      resolvedAt: new Date(),
      resolvedById,
    },
  });
}
