import { GoogleGenAI } from "@google/genai";
import {
  AIProvider,
  AIError,
  GenerateTextParams,
  GenerateTextResult,
  GenerateStructuredParams,
  GenerateStructuredResult,
  StreamTextParams,
  StreamTextResult,
  EmbedParams,
  EmbedResult,
  EmbedManyParams,
  EmbedManyResult,
  TokenUsage,
  TextMessage,
} from "./provider";

/**
 * Google Gemini Provider Implementation using official @google/genai SDK.
 */
export class GeminiProvider implements AIProvider {
  public readonly name = "gemini";
  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey.includes("your-gemini-key")) {
        throw new AIError(
          "GEMINI_API_KEY is not configured. Please set a valid GEMINI_API_KEY in your environment or .env.local.",
          "INVALID_KEY",
          401
        );
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Helper to format generic messages into Gemini contents and system instruction.
   */
  private formatMessages(
    messages: TextMessage[],
    explicitSystem?: string
  ): {
    systemInstruction?: string;
    contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
  } {
    let systemInstruction = explicitSystem;
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = systemInstruction
          ? `${systemInstruction}\n\n${msg.content}`
          : msg.content;
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    return { systemInstruction, contents };
  }

  /**
   * Safe execution with bounded exponential backoff on transient 429 rate limits and 503 high-demand errors.
   */
  private async withRetry<T>(operation: () => Promise<T>, maxRetries = 2): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await operation();
      } catch (err: unknown) {
        attempt++;
        const errorMessage = err instanceof Error ? err.message : String(err);

        // Immediate fail on non-retryable authentication or authorization errors
        if (
          errorMessage.includes("API key not valid") ||
          errorMessage.includes("API_KEY_INVALID") ||
          errorMessage.includes("401") ||
          errorMessage.includes("PERMISSION_DENIED")
        ) {
          throw new AIError("Invalid Gemini API key provided.", "INVALID_KEY", 401, err);
        }

        const isRateLimit =
          errorMessage.includes("429") ||
          errorMessage.includes("RESOURCE_EXHAUSTED") ||
          errorMessage.toLowerCase().includes("quota");

        const isUnavailable =
          errorMessage.includes("503") ||
          errorMessage.includes("UNAVAILABLE") ||
          errorMessage.toLowerCase().includes("high demand") ||
          errorMessage.toLowerCase().includes("overloaded") ||
          errorMessage.toLowerCase().includes("try again later");

        const isTransient = isRateLimit || isUnavailable;

        if (isTransient && attempt <= maxRetries) {
          const delay = Math.min(Math.pow(2, attempt - 1) * 1000 + Math.random() * 400, 3000);
          console.warn(
            `[GeminiProvider] Transient ${isRateLimit ? "rate limit (429)" : "high demand (503)"} hit. Retrying in ${Math.round(delay)}ms (attempt ${attempt}/${maxRetries})...`
          );
          await new Promise((res) => setTimeout(res, delay));
          continue;
        }

        if (isRateLimit) {
          throw new AIError("AI service rate limit reached. Please wait a moment before trying again.", "RATE_LIMIT", 429, err);
        }

        if (isUnavailable) {
          throw new AIError(
            "The AI service is temporarily experiencing high demand. Please try again in a few moments.",
            "UNAVAILABLE",
            503,
            err
          );
        }

        throw new AIError(
          "AI service encountered an unexpected error. Please try again.",
          "PROVIDER_ERROR",
          500,
          err
        );
      }
    }
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const ai = this.getClient();
    const fallbackModel = process.env.FAST_MODEL || "gemini-3.5-flash-lite";
    const { systemInstruction, contents } = this.formatMessages(
      params.messages,
      params.systemInstruction
    );

    const execute = (modelToUse: string) =>
      this.withRetry(async () => {
        return ai.models.generateContent({
          model: modelToUse,
          contents,
          config: {
            systemInstruction,
            temperature: params.temperature,
            maxOutputTokens: params.maxTokens,
          },
        });
      });

    let response;
    try {
      response = await execute(params.model);
    } catch (err) {
      if (
        params.model !== fallbackModel &&
        err instanceof AIError &&
        (err.code === "UNAVAILABLE" || err.code === "RATE_LIMIT")
      ) {
        console.warn(
          `[GeminiProvider] Primary model "${params.model}" unavailable (${err.code}). Falling back to "${fallbackModel}"...`
        );
        response = await execute(fallbackModel);
      } else {
        throw err;
      }
    }

    const usage: TokenUsage = {
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
    };

    return {
      text: response.text ?? "",
      usage,
    };
  }

  async generateStructured<T>(params: GenerateStructuredParams): Promise<GenerateStructuredResult<T>> {
    const ai = this.getClient();
    const fallbackModel = process.env.FAST_MODEL || "gemini-3.5-flash-lite";
    const { systemInstruction, contents } = this.formatMessages(
      params.messages,
      params.systemInstruction
    );

    const execute = (modelToUse: string) =>
      this.withRetry(async () => {
        return ai.models.generateContent({
          model: modelToUse,
          contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseJsonSchema: params.schema,
            temperature: params.temperature,
            maxOutputTokens: params.maxTokens,
          },
        });
      });

    let response;
    try {
      response = await execute(params.model);
    } catch (err) {
      if (
        params.model !== fallbackModel &&
        err instanceof AIError &&
        (err.code === "UNAVAILABLE" || err.code === "RATE_LIMIT")
      ) {
        console.warn(
          `[GeminiProvider] Primary model "${params.model}" unavailable (${err.code}). Falling back to "${fallbackModel}"...`
        );
        response = await execute(fallbackModel);
      } else {
        throw err;
      }
    }

    const rawText = response.text ?? "{}";
    let parsed: T;
    try {
      parsed = JSON.parse(rawText) as T;
    } catch (parseError) {
      throw new AIError(
        `Failed to parse structured JSON from Gemini response: ${rawText}`,
        "INVALID_RESPONSE",
        500,
        parseError
      );
    }

    const usage: TokenUsage = {
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
    };

    return {
      data: parsed,
      rawText,
      usage,
    };
  }

  async streamText(params: StreamTextParams): Promise<StreamTextResult> {
    const ai = this.getClient();
    const fallbackModel = process.env.FAST_MODEL || "gemini-3.5-flash-lite";
    const { systemInstruction, contents } = this.formatMessages(
      params.messages,
      params.systemInstruction
    );

    const executeStream = (modelToUse: string) =>
      this.withRetry(async () => {
        return ai.models.generateContentStream({
          model: modelToUse,
          contents,
          config: {
            systemInstruction,
            temperature: params.temperature,
            maxOutputTokens: params.maxTokens,
          },
        });
      });

    let streamResponse: Awaited<ReturnType<typeof executeStream>>;
    try {
      streamResponse = await executeStream(params.model);
    } catch (err) {
      if (
        params.model !== fallbackModel &&
        err instanceof AIError &&
        (err.code === "UNAVAILABLE" || err.code === "RATE_LIMIT")
      ) {
        console.warn(
          `[GeminiProvider] Primary model "${params.model}" unavailable (${err.code}). Falling back to "${fallbackModel}"...`
        );
        streamResponse = await executeStream(fallbackModel);
      } else {
        throw err;
      }
    }

    let finalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let usageResolver: (usage: TokenUsage) => void;
    const usagePromise = new Promise<TokenUsage>((resolve) => {
      usageResolver = resolve;
    });

    async function* makeTextStream(): AsyncIterable<string> {
      try {
        for await (const chunk of streamResponse) {
          const text = chunk.text;
          if (text) {
            yield text;
          }
          if (chunk.usageMetadata) {
            finalUsage = {
              inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
              outputTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: chunk.usageMetadata.totalTokenCount ?? 0,
            };
          }
        }
      } finally {
        usageResolver(finalUsage);
      }
    }

    return {
      textStream: makeTextStream(),
      getUsage: () => usagePromise,
    };
  }

  async embed(params: EmbedParams): Promise<EmbedResult> {
    const ai = this.getClient();

    return this.withRetry(async () => {
      const response = await ai.models.embedContent({
        model: params.model,
        contents: params.text,
        config: {
          outputDimensionality: params.outputDimensionality ?? 1536,
          taskType: params.taskType ?? "RETRIEVAL_QUERY",
        },
      });

      const values = response.embeddings?.[0]?.values ?? [];
      return { values };
    });
  }

  async embedMany(params: EmbedManyParams): Promise<EmbedManyResult> {
    const ai = this.getClient();
    const outputDimensionality = params.outputDimensionality ?? 1536;
    const taskType = params.taskType ?? "RETRIEVAL_DOCUMENT";
    const embeddings: number[][] = new Array(params.texts.length);

    // Process in bounded concurrent batches of 5 requests to respect rate limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < params.texts.length; i += BATCH_SIZE) {
      const slice = params.texts.slice(i, i + BATCH_SIZE);
      const batchPromises = slice.map((text, idx) =>
        this.withRetry(async () => {
          const response = await ai.models.embedContent({
            model: params.model,
            contents: text,
            config: {
              outputDimensionality,
              taskType,
            },
          });
          embeddings[i + idx] = response.embeddings?.[0]?.values ?? [];
        })
      );
      await Promise.all(batchPromises);
    }

    return { embeddings };
  }
}
