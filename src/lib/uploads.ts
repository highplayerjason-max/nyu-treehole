import { unlink } from "fs/promises";
import { resolve, sep } from "path";

function getLocalUploadPath(url: string) {
  if (!url.startsWith("/uploads/")) {
    return null;
  }

  const uploadsRoot = resolve(process.cwd(), "public", "uploads");
  const filePath = resolve(process.cwd(), "public", url.slice(1));

  if (filePath !== uploadsRoot && !filePath.startsWith(`${uploadsRoot}${sep}`)) {
    return null;
  }

  return filePath;
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
