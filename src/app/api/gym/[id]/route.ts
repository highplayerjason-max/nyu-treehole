import { CommunityBoard } from "@prisma/client";
import { NextRequest } from "next/server";
import {
  deleteCommunityPost,
  getCommunityPost,
  updateCommunityPost,
} from "@/lib/community-api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return getCommunityPost(id, CommunityBoard.GYM);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return updateCommunityPost(req, id, CommunityBoard.GYM);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return deleteCommunityPost(id, CommunityBoard.GYM);
}
