import "server-only";

export type AIChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface AIProvider {
  stream(messages: AIChatMessage[]): Promise<Response>;
  readonly name: string;
}

/** OpenAI-compatible streaming adapter. Provider choice is isolated from app logic. */
class OpenAICompatibleProvider implements AIProvider {
  constructor(
    public readonly name: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async stream(messages: AIChatMessage[]): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        temperature: 0.2,
        max_tokens: 900,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok || !response.body) {
      // Do not forward provider response bodies: they may contain internal details.
      throw new Error("The AI provider is temporarily unavailable.");
    }
    return response;
  }
}

export function getAIProvider(): AIProvider {
  const selected = (process.env.AI_PROVIDER ?? "groq").toLowerCase();
  if (selected === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("AI is not configured. Add OPENAI_API_KEY to the server environment.");
    return new OpenAICompatibleProvider("openai", "https://api.openai.com/v1", key, process.env.OPENAI_MODEL ?? "gpt-4o-mini");
  }

  if (selected !== "groq") throw new Error("AI_PROVIDER must be either groq or openai.");
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("AI is not configured. Add GROQ_API_KEY to the server environment.");
  return new OpenAICompatibleProvider("groq", "https://api.groq.com/openai/v1", key, process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile");
}
