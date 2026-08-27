import {
  BedrockRuntimeClient,
  ConverseCommand,
  InvokeModelCommand,
  type ConverseCommandInput,
  type InvokeModelCommandInput
} from "@aws-sdk/client-bedrock-runtime";
import type { DocumentType } from "@smithy/types";

import type {
  CurrentCheckIn,
  Pivot
} from "../app/pivot-protocol";
import type {
  DerivedMemoryDraft,
  ModelRecommendation,
  PivotModel,
  StoredMemorySummary
} from "./pivot-service";

export const TITAN_EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0";
export const NOVA_LITE_MODEL_ID = "amazon.nova-lite-v1:0";
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 1;

type BedrockCommand = ConverseCommand | InvokeModelCommand;
type BedrockSender = (command: BedrockCommand) => Promise<unknown>;

export type BedrockAdapterConfig = {
  region?: string;
  embeddingModelId?: string;
  generationModelId?: string;
  timeoutMs?: number;
};

export type BedrockAdapters = {
  model: PivotModel;
  embed: (text: string) => Promise<readonly number[]>;
};

export function createBedrockAdapters(
  config: BedrockAdapterConfig = {},
  sender?: BedrockSender
): BedrockAdapters {
  const embeddingModelId = config.embeddingModelId ?? TITAN_EMBEDDING_MODEL_ID;
  const generationModelId = config.generationModelId ?? NOVA_LITE_MODEL_ID;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  assertAllowedModel(embeddingModelId, "embedding");
  assertAllowedModel(generationModelId, "generation");

  const client = new BedrockRuntimeClient({ region: config.region ?? process.env.AWS_REGION });
  const send: BedrockSender =
    sender ?? ((command) => client.send(command as never));

  async function converse(input: ConverseCommandInput): Promise<BedrockConverseResponse> {
    return sendWithRetry(
      () => send(new ConverseCommand(input)).then(asConverseResponse),
      timeoutMs
    );
  }

  async function invokeEmbedding(input: InvokeModelCommandInput): Promise<TitanEmbeddingResponse> {
    return sendWithRetry(
      () => send(new InvokeModelCommand(input)).then(asEmbeddingResponse),
      timeoutMs
    );
  }

  const model: PivotModel = {
    async deriveMemory({ checkIn }) {
      const response = await converse({
        modelId: generationModelId,
        system: [
          {
            text:
              "You create Unstuck Derived memory. Return JSON only with one field, derivedContext. Keep it factual, short, and grounded in the person's words. Do not diagnose, label personality, predict crisis, or invent facts."
          }
        ],
        messages: [
          {
            role: "user",
            content: [{ text: `Current Check-in:\n${checkIn.quickDump}\nEmotional state: ${checkIn.emotionalState}/5` }]
          }
        ],
        inferenceConfig: {
          temperature: 0.2,
          maxTokens: 180
        }
      });

      return parseDerivedMemory(responseText(response));
    },

    async recommend({
      checkIn,
      currentDerivedContext,
      retrievedMemories,
      retrieveSimilarMemories
    }) {
      const toolName = "retrieve_similar_memories";
      const firstResponse = await converse({
        modelId: generationModelId,
        system: [
          {
            text:
              "You are the bounded Unstuck Pivot guide. Request the retrieve_similar_memories tool exactly once before recommending a Pivot. You may only recommend one of these Pivot kinds: grounding, breathing-focus, reaching-out, basic-needs-reset, task-first-step. Never invent actions, diagnose, or make crisis predictions."
          }
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                text: recommendationPrompt(checkIn, currentDerivedContext)
              }
            ]
          }
        ],
        toolConfig: {
          tools: [
            {
              toolSpec: {
                name: toolName,
                description:
                  "Retrieve up to three already-filtered Derived memories owned by the authenticated person. The backend supplies identity, query, threshold, and limit.",
                inputSchema: { json: { type: "object", additionalProperties: false } }
              }
            }
          ]
        },
        inferenceConfig: {
          temperature: 0.2,
          maxTokens: 220
        }
      });

      const toolUse = findToolUse(firstResponse, toolName);
      const retrieved = toolUse ? await retrieveSimilarMemories() : retrievedMemories;

      const finalResponse = await converse({
        modelId: generationModelId,
        system: [
          {
            text:
              "Return JSON only with fields primaryPivotKind, alternativePivotKinds, whyThisPivot, and optional memoryId. Use only the bounded Pivot kinds. Include memoryId only when one retrieved memory genuinely supports the recommendation. Keep whyThisPivot under 280 characters and factual."
          }
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                text: recommendationPrompt(checkIn, currentDerivedContext)
              }
            ]
          },
          ...(toolUse
            ? [
                {
                  role: "assistant" as const,
                  content: [{ toolUse }]
                },
                {
                  role: "user" as const,
                  content: [
                    {
                      toolResult: {
                        toolUseId: toolUse.toolUseId,
                        content: [{ json: { memories: Array.from(retrieved) } }]
                      }
                    }
                  ]
                }
              ]
            : []),
          {
            role: "user",
            content: [{ text: `Retrieved Derived memories:\n${JSON.stringify(retrieved)}` }]
          }
        ],
        inferenceConfig: {
          temperature: 0.2,
          maxTokens: 220
        }
      });

      return parseRecommendation(responseText(finalResponse));
    },

    async updateDerivedMemory({ currentDerivedContext, selectedPivot, outcomeKind }) {
      const response = await converse({
        modelId: generationModelId,
        system: [
          {
            text:
              "Update an Unstuck Derived memory. Return JSON only with one field, derivedContext. Keep it short and factual. Do not diagnose, label personality, predict crisis, or invent facts."
          }
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                text: `Existing Derived memory: ${currentDerivedContext}\nSelected Pivot: ${selectedPivot.title}\nOutcome: ${outcomeKind}`
              }
            ]
          }
        ],
        inferenceConfig: {
          temperature: 0.2,
          maxTokens: 180
        }
      });

      return parseDerivedMemory(responseText(response));
    }
  };

  return {
    model,
    embed: async (text) => {
      const response = await invokeEmbedding({
        modelId: embeddingModelId,
        contentType: "application/json",
        accept: "application/json",
        body: new TextEncoder().encode(
          JSON.stringify({ inputText: text, dimensions: 1024, normalize: true })
        )
      });

      if (!Array.isArray(response.embedding) || response.embedding.length !== 1024) {
        throw new Error("Titan returned an unexpected embedding dimension");
      }

      return response.embedding;
    }
  };
}

function recommendationPrompt(
  checkIn: CurrentCheckIn,
  currentDerivedContext: string
): string {
  return [
    `Current Derived memory: ${currentDerivedContext}`,
    `Current emotional state: ${checkIn.emotionalState}/5`,
    "Retrieve relevant memory, then choose one small Pivot from the allowed library."
  ].join("\n");
}

function assertAllowedModel(modelId: string, role: "embedding" | "generation"): void {
  const allowed = role === "embedding" ? TITAN_EMBEDDING_MODEL_ID : NOVA_LITE_MODEL_ID;
  if (modelId !== allowed) {
    throw new Error(`Unapproved Bedrock ${role} model: ${modelId}`);
  }
}

async function sendWithRetry<T>(
  send: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await withTimeout(send(), timeoutMs);
    } catch (error) {
      if (attempt >= MAX_RETRIES || !isTransientError(error)) {
        throw error;
      }

      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, 80 * attempt));
    }
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Bedrock request timed out")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /timeout|throttl|temporar|unavailable|service/i.test(error.message);
}

type BedrockConverseResponse = {
  output?: {
    message?: {
      content?: readonly BedrockContentBlock[];
    };
  };
};

type BedrockContentBlock = {
  text?: string;
  toolUse?: {
    toolUseId: string;
    name: string;
    input: DocumentType;
  };
};

type TitanEmbeddingResponse = {
  embedding?: unknown;
};

function asConverseResponse(value: unknown): BedrockConverseResponse {
  return value as BedrockConverseResponse;
}

async function asEmbeddingResponse(value: unknown): Promise<TitanEmbeddingResponse> {
  const response = value as { body?: Uint8Array };
  if (!response.body) {
    throw new Error("Bedrock returned no embedding body");
  }

  return JSON.parse(new TextDecoder().decode(response.body)) as TitanEmbeddingResponse;
}

function responseText(response: BedrockConverseResponse): string {
  const text = response.output?.message?.content?.find(
    (block): block is { text: string } => typeof block.text === "string"
  )?.text;

  if (!text) {
    throw new Error("Bedrock returned no text response");
  }

  return text;
}

function findToolUse(
  response: BedrockConverseResponse,
  expectedName: string
): NonNullable<BedrockContentBlock["toolUse"]> | undefined {
  const toolUse = response.output?.message?.content?.find(
    (block): block is { toolUse: NonNullable<BedrockContentBlock["toolUse"]> } =>
      Boolean(block.toolUse)
  )?.toolUse;

  if (!toolUse) {
    return undefined;
  }

  if (toolUse.name !== expectedName || typeof toolUse.toolUseId !== "string") {
    throw new Error("Bedrock returned an invalid retrieval tool call");
  }

  return toolUse;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i)?.[1] ?? text;
  const value: unknown = JSON.parse(fenced);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Bedrock returned non-object JSON");
  }

  return value as Record<string, unknown>;
}

function parseDerivedMemory(text: string): DerivedMemoryDraft {
  const value = parseJsonObject(text);
  if (typeof value.derivedContext !== "string") {
    throw new Error("Bedrock returned an invalid Derived memory");
  }

  return { derivedContext: value.derivedContext };
}

function parseRecommendation(text: string): ModelRecommendation {
  const value = parseJsonObject(text);
  if (
    typeof value.primaryPivotKind !== "string" ||
    !Array.isArray(value.alternativePivotKinds) ||
    value.alternativePivotKinds.some((kind) => typeof kind !== "string") ||
    typeof value.whyThisPivot !== "string" ||
    (value.memoryId !== undefined && typeof value.memoryId !== "string")
  ) {
    throw new Error("Bedrock returned an invalid Pivot recommendation");
  }

  return {
    primaryPivotKind: value.primaryPivotKind,
    alternativePivotKinds: value.alternativePivotKinds,
    whyThisPivot: value.whyThisPivot,
    ...(value.memoryId === undefined ? {} : { memoryId: value.memoryId })
  };
}
