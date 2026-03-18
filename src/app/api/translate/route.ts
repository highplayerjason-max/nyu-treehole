import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { translateText } from "@/lib/translate";
import type { Lang } from "@/lib/i18n";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const text: string = body.text ?? "";
  const targetLang: Lang = body.targetLang === "en" ? "en" : "zh";

  if (!text.trim()) {
    return NextResponse.json({ translated: "" });
  }

  const translated = await translateText(text, targetLang);
  return NextResponse.json({ translated });
}
