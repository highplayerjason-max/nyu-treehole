import { readFile, stat } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { getLocalUploadPath, getUploadContentType } from "@/lib/uploads";

export const runtime = "nodejs";

function buildUploadUrl(pathSegments: string[]) {
  return `/uploads/${pathSegments.join("/")}`;
}

async function getUploadResponse(pathSegments: string[], includeBody: boolean) {
  if (!pathSegments.length) {
    return new NextResponse("Not found", { status: 404 });
  }

  const uploadUrl = buildUploadUrl(pathSegments);
  const filePath = getLocalUploadPath(uploadUrl);
  if (!filePath) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const fileStat = await stat(filePath);
    const headers = new Headers({
      "Content-Type": getUploadContentType(filePath),
      "Content-Length": String(fileStat.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });

    if (!includeBody) {
      return new NextResponse(null, { status: 200, headers });
    }

    const file = await readFile(filePath);
    return new NextResponse(file, { status: 200, headers });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      return new NextResponse("Not found", { status: 404 });
    }

    console.error("Failed to serve upload:", uploadUrl, error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  context: RouteContext<"/uploads/[...path]">
) {
  const { params } = context;
  const { path } = await params;
  return getUploadResponse(path, true);
}

export async function HEAD(
  _req: NextRequest,
  context: RouteContext<"/uploads/[...path]">
) {
  const { params } = context;
  const { path } = await params;
  return getUploadResponse(path, false);
}
