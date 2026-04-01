import { NextRequest } from "next/server";
import { reportCommunityComment } from "@/lib/community-api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return reportCommunityComment(req, id);
}
