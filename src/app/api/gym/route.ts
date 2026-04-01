import { CommunityBoard } from "@prisma/client";
import { NextRequest } from "next/server";
import {
  createCommunityPost,
  listCommunityPosts,
} from "@/lib/community-api";

export async function GET(req: NextRequest) {
  return listCommunityPosts(req, CommunityBoard.GYM);
}

export async function POST(req: NextRequest) {
  return createCommunityPost(req, CommunityBoard.GYM);
}
