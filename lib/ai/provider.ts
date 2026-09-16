/**
 * Generic AI Provider Abstraction
 * Decouples application domain logic from specific LLM vendors.
 */

export interface TextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number;
}

export interface GenerateTextParams {
  model: string;
  messages: TextMessage[];
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateTextResult {
  text: string;
  usage: TokenUsage;
  finishReason?: string;
}

export interface GenerateStructuredParams {
  model: string;
  messages: TextMessage[];
  schema: unknown;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateStructuredResult<T> {
  data: T;
  rawText: string;
  usage: TokenUsage;
}

export interface StreamTextParams {
  model: string;
  messages: TextMessage[];
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamTextResult {
  textStream: AsyncIterable<string>;
  getUsage: () => Promise<TokenUsage>;
}

export interface EmbedParams {
  model: string;
  text: string;
  outputDimensionality?: number;
  taskType?: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT";
}

export interface EmbedResult {
  values: number[];
}

export interface EmbedManyParams {
  model: string;
  texts: string[];
  outputDimensionality?: number;
  taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
}

export interface EmbedManyResult {
  embeddings: number[][];
}

export interface AIProvider {
  name: string;
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
  generateStructured<T>(params: GenerateStructuredParams): Promise<GenerateStructuredResult<T>>;
  streamText(params: StreamTextParams): Promise<StreamTextResult>;
  embed(params: EmbedParams): Promise<EmbedResult>;
  embedMany(params: EmbedManyParams): Promise<EmbedManyResult>;
}

export class AIError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_KEY"
      | "RATE_LIMIT"
      | "TIMEOUT"
      | "INVALID_RESPONSE"
      | "PROVIDER_ERROR"
      | "UNAVAILABLE",
    public readonly status?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = "AIError";
  }
}
