import { CommunityBoard } from "@prisma/client";
import { NextRequest } from "next/server";
import { reportCommunityPost } from "@/lib/community-api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return reportCommunityPost(req, id, CommunityBoard.GYM);
}
