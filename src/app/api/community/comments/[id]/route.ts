import { NextRequest } from "next/server";
import {
  deleteCommunityComment,
  updateCommunityComment,
} from "@/lib/community-api";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return updateCommunityComment(req, id);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return deleteCommunityComment(id);
}
