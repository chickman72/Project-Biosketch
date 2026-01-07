export type LLMEnhancer = {
  enabled: boolean;
  enhanceHeadings: (text: string) => Promise<string>;
  enhanceCitations: (citations: string[]) => Promise<string[]>;
};

export function createLLMEnhancer(): LLMEnhancer {
  const enabled = Boolean(
    process.env.AZURE_OPENAI_ENDPOINT &&
      process.env.AZURE_OPENAI_API_KEY &&
      process.env.AZURE_OPENAI_DEPLOYMENT
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
    };
  }

  return {
    enabled: true,
    async enhanceHeadings(text: string) {
      // Explicitly left as a stub for MVP. Wire Azure OpenAI here when needed.
      return text;
    },
    async enhanceCitations(citations: string[]) {
      // Explicitly left as a stub for MVP. Wire Azure OpenAI here when needed.
      return citations;
    },
  };
}
