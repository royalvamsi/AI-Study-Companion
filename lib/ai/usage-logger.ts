import { createAdminClient } from "@/lib/supabase/admin";
import type { SupportedModel } from "@/lib/ai/models";

interface LogAiUsageParams {
  userId?: string;
  projectId?: string;
  feature: string;
  model: SupportedModel | string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  status: "success" | "error";
  error?: string;
}

/**
 * Log an AI call to ai_usage_logs.
 * Fire-and-forget — never throws, as we don't want logging to break the main flow.
 */
export async function logAiUsage(params: LogAiUsageParams): Promise<void> {
  try {
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("ai_usage_logs") as any).insert({
      user_id: params.userId ?? null,
      project_id: params.projectId ?? null,
      feature: params.feature,
      model: params.model,
      latency_ms: params.latencyMs,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      estimated_cost_usd: params.estimatedCostUsd,
      status: params.status,
      error: params.error ?? null,
    });
  } catch {
    // Intentionally silent — never let logging break the caller
  }
}
