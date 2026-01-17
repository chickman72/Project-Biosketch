export type LLMEnhancer = {
  enabled: boolean;
  enhanceHeadings: (text: string) => Promise<string>;
  enhanceCitations: (citations: string[]) => Promise<string[]>;
  extractStructuredData: (text: string) => Promise<unknown | null>;
};

const PROMPT_PATH = "config/litellm-system-prompt.md";
let cachedPrompt: string | null = null;

async function loadPrompt(): Promise<string> {
  if (cachedPrompt) {
    return cachedPrompt;
  }
  const { readFile } = await import("node:fs/promises");
  cachedPrompt = await readFile(PROMPT_PATH, "utf-8");
  return cachedPrompt;
}

async function callLiteLLM(systemPrompt: string, userContent: string) {
  const baseUrl = process.env.LITELLM_BASE_URL ?? "";
  const apiKey = process.env.LITELLM_API_KEY ?? "";
  const model = process.env.LITELLM_MODEL ?? "";

  if (!baseUrl || !apiKey || !model) {
    return null;
  }

  const normalizedBase = baseUrl.replace(/\/$/, "");
  const endpoint = normalizedBase.endsWith("/v1")
    ? `${normalizedBase}/chat/completions`
    : `${normalizedBase}/v1/chat/completions`;

  const { mkdir, appendFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const logPath = "logs/llm-debug.txt";

  const writeLog = async (entry: string) => {
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, entry, "utf-8");
  };

  try {
    await writeLog(
      [
        `--- LLM REQUEST ${new Date().toISOString()} ---`,
        `model: ${model}`,
        `system_prompt_chars: ${systemPrompt.length}`,
        `input_chars: ${userContent.length}`,
        "SYSTEM_PROMPT_BEGIN",
        systemPrompt,
        "SYSTEM_PROMPT_END",
        "INPUT_BEGIN",
        userContent,
        "INPUT_END",
        "",
      ].join("\n")
    );

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      await writeLog(
        [
          `LLM ERROR status: ${response.status}`,
          `LLM ERROR statusText: ${response.statusText}`,
          "",
        ].join("\n")
      );
      return null;
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    await writeLog(
      [
        `--- LLM RESPONSE ${new Date().toISOString()} ---`,
        `output_chars: ${content?.length ?? 0}`,
        "OUTPUT_BEGIN",
        content ?? "",
        "OUTPUT_END",
        "",
      ].join("\n")
    );
    return content ?? null;
  } catch {
    await writeLog(
      [
        `--- LLM EXCEPTION ${new Date().toISOString()} ---`,
        "LLM request failed with exception.",
        "",
      ].join("\n")
    );
    return null;
  }
}

export function createLLMEnhancer(): LLMEnhancer {
  const enabled = Boolean(
    process.env.LITELLM_BASE_URL &&
      process.env.LITELLM_API_KEY &&
      process.env.LITELLM_MODEL
  );

  if (!enabled) {
    return {
      enabled: false,
      async enhanceHeadings(text: string) {
        return text;
      },
      async enhanceCitations(citations: string[]) {
        return citations;
      },
      async extractStructuredData() {
        return null;
      },
    };
  }

  return {
    enabled: true,
    async enhanceHeadings(text: string) {
      // Explicitly left as a stub for MVP. Wire optional heading cleanup here when needed.
      return text;
    },
    async enhanceCitations(citations: string[]) {
      // Explicitly left as a stub for MVP. Wire optional citation cleanup here when needed.
      return citations;
    },
    async extractStructuredData(text: string) {
      const prompt = await loadPrompt();
      const content = await callLiteLLM(prompt, text);
      if (!content) {
        return null;
      }
      try {
        const trimmed = content.trim();
        const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
        const jsonText = fencedMatch ? fencedMatch[1].trim() : trimmed;
        return JSON.parse(jsonText);
      } catch {
        return null;
      }
    },
  };
}
