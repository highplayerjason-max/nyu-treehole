import { unlink } from "fs/promises";
import { extname, resolve, sep } from "path";

const UPLOADS_PREFIX = "/uploads/";

export function getUploadsRoot() {
  return resolve(process.cwd(), "public", "uploads");
}

export function buildLocalUploadUrl(filename: string) {
  return `${UPLOADS_PREFIX}${filename}`;
}

export function isLocalUploadUrl(url: string) {
  return url.startsWith(UPLOADS_PREFIX);
}

export function isAcceptedImageUrl(url: string) {
  if (!url) {
    return false;
  }

  if (isLocalUploadUrl(url)) {
    return true;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getLocalUploadPath(url: string) {
  if (!isLocalUploadUrl(url)) {
    return null;
  }

  const uploadsRoot = getUploadsRoot();
  const relativePath = url.slice(UPLOADS_PREFIX.length);
  if (!relativePath || relativePath.includes("\0")) {
    return null;
  }

  const filePath = resolve(uploadsRoot, relativePath);

  if (filePath !== uploadsRoot && !filePath.startsWith(`${uploadsRoot}${sep}`)) {
    return null;
  }

  return filePath;
}

export function getUploadContentType(urlOrPath: string) {
  switch (extname(urlOrPath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export async function deleteUploadedFiles(urls: Array<string | null | undefined>) {
  const uniqueUrls = [...new Set(urls.filter(Boolean))] as string[];

  await Promise.all(
    uniqueUrls.map(async (url) => {
      const filePath = getLocalUploadPath(url);
      if (!filePath) return;

      try {
        await unlink(filePath);
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !("code" in error) ||
          error.code !== "ENOENT"
        ) {
          console.error("Failed to delete upload:", url, error);
        }
      }
    })
  );
}
