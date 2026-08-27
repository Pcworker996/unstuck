import { createBedrockAdapters } from "./bedrock-adapter";
import { createCockroachMemoryRepository } from "./cockroach-memory-repository";
import type {
  PivotProtocolServiceDependencies,
  RecordPivotOutcomeDependencies
} from "./pivot-service";

let runtime:
  | {
      pivot: PivotProtocolServiceDependencies;
      outcome: RecordPivotOutcomeDependencies;
    }
  | undefined;

export function getPivotRuntime(): {
  pivot: PivotProtocolServiceDependencies;
  outcome: RecordPivotOutcomeDependencies;
} {
  if (runtime) {
    return runtime;
  }

  const bedrock = createBedrockAdapters({
    region: process.env.AWS_REGION,
    embeddingModelId: process.env.BEDROCK_EMBEDDING_MODEL_ID,
    generationModelId: process.env.BEDROCK_GENERATION_MODEL_ID,
    timeoutMs: parsePositiveInteger(process.env.BEDROCK_TIMEOUT_MS) ?? 12_000
  });
  const repository = createCockroachMemoryRepository({
    connectionString: process.env.DATABASE_URL,
    maxConnections: parsePositiveInteger(process.env.DATABASE_POOL_MAX) ?? 5
  });

  runtime = {
    pivot: {
      repository,
      model: bedrock.model,
      embed: bedrock.embed,
      embeddingDimensions: 1024,
      retrievalLimit: 3,
      retrievalThreshold: parseNumber(process.env.MEMORY_SIMILARITY_THRESHOLD) ?? 0.5,
      logger: consoleLogger
    },
    outcome: {
      repository,
      model: bedrock.model,
      embed: bedrock.embed,
      embeddingDimensions: 1024,
      logger: consoleLogger
    }
  };

  return runtime;
}

const consoleLogger = {
  event(name: string, fields: Record<string, string | number | boolean | undefined>) {
    console.info(JSON.stringify({ event: name, ...fields }));
  }
};

export function resetPivotRuntimeForTests(): void {
  runtime = undefined;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : undefined;
}
