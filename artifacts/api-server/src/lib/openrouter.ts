import { logger } from "./logger";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = "https://openrouter.ai/api/v1";

const MODELS = [
  "openai/gpt-4o-mini",
  "deepseek/deepseek-r1",
  "meta-llama/llama-3.3-70b-instruct",
];

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

async function callModel(
  model: string,
  messages: ChatCompletionMessage[],
  options: CompletionOptions = {},
): Promise<string> {
  const { temperature = 0.7, maxTokens = 4096, timeoutMs = 60000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://iso-gestao-ia.replit.app",
        "X-Title": "ISO Gestão IA",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

export async function chat(
  messages: ChatCompletionMessage[],
  options: CompletionOptions = {},
): Promise<string> {
  for (let attempt = 0; attempt < MODELS.length; attempt++) {
    const model = MODELS[attempt]!;
    try {
      logger.info({ model, attempt }, "Calling OpenRouter");
      const result = await callModel(model, messages, options);
      return result;
    } catch (err) {
      logger.warn({ model, attempt, err }, "Model failed, trying fallback");
      if (attempt === MODELS.length - 1) {
        throw err;
      }
    }
  }
  throw new Error("All models failed");
}
