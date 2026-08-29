import { PIVOT_LIBRARY } from "../app/pivot-library";
import { runGooglePivotProtocol } from "../app/google-pivot-protocol";
import { createGenkitGooglePivotGenerator, type GoogleModelUsage } from "../server/genkit-google-pivot-generator";
import { GOOGLE_EVALUATION_PROMPT_VERSION } from "./google-protocol-evaluation";

const SYNTHETIC_LIVE_CASE_ID = "live-moving-administration";
const DEFAULT_INPUT_COST_PER_MILLION = 0.075;
const DEFAULT_OUTPUT_COST_PER_MILLION = 0.3;

export type LiveGoogleEvaluationReport = {
  kind: "live-vertex-evaluation";
  promptVersion: string;
  modelId: string;
  inputCaseId: string;
  syntheticOnly: true;
  status: "passed" | "failed";
  schemaValid: boolean;
  invariantResults: Record<string, boolean>;
  latencyMs: number;
  tokenUse: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
  estimatedCostUsd: number | null;
  errorKind?: "vertex-evaluation-failed";
};

export async function runLiveGoogleEvaluation(): Promise<LiveGoogleEvaluationReport> {
  const usage: GoogleModelUsage = {};
  const modelId = process.env.VERTEX_GEMINI_MODEL_ID?.trim() || "gemini-3.5-flash";
  const startedAt = Date.now();
  try {
    const result = await runGooglePivotProtocol(
      {
        quickDump: "Synthetic evaluation: moving paperwork is scattered and I need one small next step.",
        consentGiven: true
      },
      createGenkitGooglePivotGenerator(undefined, (nextUsage) => addUsage(usage, nextUsage))
    );
    const invariantResults = liveInvariants(result);
    const usageResult = normalizedUsage(usage);
    return {
      kind: "live-vertex-evaluation",
      promptVersion: GOOGLE_EVALUATION_PROMPT_VERSION,
      modelId,
      inputCaseId: SYNTHETIC_LIVE_CASE_ID,
      syntheticOnly: true,
      status: Object.values(invariantResults).every(Boolean) ? "passed" : "failed",
      schemaValid: invariantResults.schemaValid,
      invariantResults,
      latencyMs: Date.now() - startedAt,
      tokenUse: usageResult,
      estimatedCostUsd: estimateCost(usageResult)
    };
  } catch {
    const usageResult = normalizedUsage(usage);
    return {
      kind: "live-vertex-evaluation",
      promptVersion: GOOGLE_EVALUATION_PROMPT_VERSION,
      modelId,
      inputCaseId: SYNTHETIC_LIVE_CASE_ID,
      syntheticOnly: true,
      status: "failed",
      schemaValid: false,
      invariantResults: { modelCallCompleted: false },
      latencyMs: Date.now() - startedAt,
      tokenUse: usageResult,
      estimatedCostUsd: estimateCost(usageResult),
      errorKind: "vertex-evaluation-failed"
    };
  }
}

function liveInvariants(result: Awaited<ReturnType<typeof runGooglePivotProtocol>>): Record<string, boolean> {
  if (result.kind !== "pivot-protocol") {
    return { schemaValid: false, recommendationIsBounded: false, provenanceIsSeparated: false };
  }
  const pivots = result.recommendation ? [result.recommendation.primary, ...result.recommendation.alternatives] : [];
  return {
    schemaValid: !result.fallback,
    recommendationIsBounded: pivots.length === 3 && new Set(pivots.map((pivot) => pivot.kind)).size === 3 && pivots.every((pivot) => PIVOT_LIBRARY.some((candidate) => candidate.kind === pivot.kind)),
    provenanceIsSeparated: result.situationMap.shared.every((item) => item.provenance === "person") && result.situationMap.artifactClaims.every((item) => item.provenance === "artifact"),
    safetyGateIsFirst: result.activity[0]?.kind === "safety-completed"
  };
}

function addUsage(total: GoogleModelUsage, next: GoogleModelUsage): void {
  for (const field of ["inputTokens", "outputTokens", "totalTokens"] as const) {
    const value = next[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
    total[field] = (total[field] ?? 0) + value;
  }
}

function normalizedUsage(usage: GoogleModelUsage): LiveGoogleEvaluationReport["tokenUse"] {
  const totalTokens = usage.totalTokens ?? (usage.inputTokens !== undefined && usage.outputTokens !== undefined ? usage.inputTokens + usage.outputTokens : undefined);
  return {
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    totalTokens: totalTokens ?? null
  };
}

function estimateCost(usage: LiveGoogleEvaluationReport["tokenUse"]): number | null {
  if (usage.inputTokens === null || usage.outputTokens === null) return null;
  const inputRate = positiveEnvironmentNumber("GOOGLE_EVAL_INPUT_USD_PER_MILLION_TOKENS", DEFAULT_INPUT_COST_PER_MILLION);
  const outputRate = positiveEnvironmentNumber("GOOGLE_EVAL_OUTPUT_USD_PER_MILLION_TOKENS", DEFAULT_OUTPUT_COST_PER_MILLION);
  return Number(((usage.inputTokens * inputRate + usage.outputTokens * outputRate) / 1_000_000).toFixed(6));
}

function positiveEnvironmentNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
