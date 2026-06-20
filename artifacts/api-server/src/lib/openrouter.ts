import { logger } from "./logger";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) { logger.error("OPENROUTER_API_KEY not set!"); } else { logger.info("OPENROUTER_API_KEY is set (length: " + OPENROUTER_API_KEY.length + ")"); }
const BASE_URL = "https://openrouter.ai/api/v1";

// Modelos gratuitos do OpenRouter (atualize se esgotar o período grátis)
// Veja modelos gratuitos em: https://openrouter.ai/models?free=1
// Modelos gratuitos testados do OpenRouter
// Free models: https://openrouter.ai/models?free=1
const MODELS = [
  // Modelos solicitados pelo usuario
  "openai/gpt-oss-120b:free",
  "google/gemma-4-31b-it:free",
  // Fallbacks adicionais
  "google/gemini-2.0-flash-exp:free",
  "deepseek/deepseek-chat:free",
  "qwen/qwen-2.5-coder-32b-instruct:free",
  "mistralai/mistral-small-24b-instruct-2501:free",
  "cognitivecomputations/dolphin-mixtral-8x7b:free",
  "microsoft/phi-3.5-mini-128k-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
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
  const { temperature = 0.7, maxTokens = 2048, timeoutMs = 120000 } = options;

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
      const errBody = await response.text().catch(() => 'no body');
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errBody.slice(0, 200)}`);
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
  // Try primary model first, then skip to backup quickly
  const primaryModel = MODELS[0];
  const backupModels = MODELS.slice(1);

  // Try primary with generous timeout
  try {
    logger.info({ model: primaryModel }, "Calling OpenRouter");
    return await callModel(primaryModel!, messages, { ...options, timeoutMs: options.timeoutMs || 120000 });
  } catch (err) {
    logger.warn({ model: primaryModel, err }, "Primary model failed, trying backups...");
  }

  // Try each backup quickly (shorter timeout per attempt)
  for (const model of backupModels) {
    try {
      logger.info({ model }, "Trying backup model");
      return await callModel(model, messages, { ...options, timeoutMs: 90000 });
    } catch (err) {
      logger.warn({ model, err: String(err) }, "Backup model failed");
    }
  }
  throw new Error("All models failed");
}
