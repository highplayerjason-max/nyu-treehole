import type { Lang } from "./i18n";

/**
 * Translate text to the target language using the configured LLM provider.
 * Returns the original text if no API key is configured (graceful degradation).
 */
export async function translateText(
  text: string,
  targetLang: Lang
): Promise<string> {
  const apiKey = process.env.LLM_MODERATION_API_KEY;
  const provider = process.env.LLM_MODERATION_PROVIDER;

  if (!apiKey || !provider) {
    return text;
  }

  const targetName = targetLang === "zh" ? "简体中文" : "English";
  const prompt = `将以下文字翻译成${targetName}，只输出翻译结果，不要加任何解释或前缀：\n\n${text}`;

  try {
    if (provider === "openai") {
      return await translateWithOpenAI(prompt, apiKey);
    } else if (provider === "anthropic") {
      return await translateWithAnthropic(prompt, apiKey);
    } else if (provider === "deepseek") {
      return await translateWithDeepSeek(prompt, apiKey);
    }
  } catch (err) {
    console.error("Translation failed:", err);
  }

  return text;
}

async function translateWithDeepSeek(
  prompt: string,
  apiKey: string
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  clearTimeout(timer);

  if (!res.ok) throw new Error(`DeepSeek translation error: ${res.status}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

async function translateWithOpenAI(
  prompt: string,
  apiKey: string
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  clearTimeout(timer);

  if (!res.ok) throw new Error(`OpenAI translation error: ${res.status}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

async function translateWithAnthropic(
  prompt: string,
  apiKey: string
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: controller.signal,
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  clearTimeout(timer);

  if (!res.ok) throw new Error(`Anthropic translation error: ${res.status}`);
  const data = await res.json();
  return (data.content?.[0]?.text || "").trim();
}
