export function getPublicAppUrl(
  configuredUrl?: string,
  fallbackOrigin?: string
) {
  const raw = (configuredUrl || fallbackOrigin || "").trim();

  if (!raw) {
    throw new Error("A public app URL is required");
  }

  const normalized = raw.match(/^https?:\/\//i) ? raw : `http://${raw}`;
  const url = new URL(normalized);

  url.hash = "";
  url.search = "";
  url.pathname = "";

  return url.toString().replace(/\/$/, "");
}

