import { genkit, z } from "genkit";
import { vertexAI } from "@genkit-ai/google-genai";

import type {
  GooglePivotGenerator,
  GooglePivotGeneratorOutput,
  PivotOutcome,
  SituationMap
} from "../app/google-pivot-protocol";
import type { Pivot } from "../app/pivot-protocol";
import { GOOGLE_EMBEDDING_DIMENSIONS, GOOGLE_EMBEDDING_MODEL_ID, validateGoogleEmbedding } from "./google-memory";

const mapItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  provenance: z.enum(["person", "artifact", "guide"])
});

const situationMapSchema = z.object({
  shared: z.array(mapItemSchema),
  artifactClaims: z.array(mapItemSchema),
  interpretations: z.array(mapItemSchema),
  uncertainties: z.array(mapItemSchema),
  contradictions: z.array(mapItemSchema),
  constraints: z.array(mapItemSchema),
  progress: z.array(mapItemSchema),
  pivotHistory: z.array(mapItemSchema),
  priorPatterns: z.array(mapItemSchema)
});

const pivotOutputSchema = z.object({
  situationMap: situationMapSchema,
  primaryPivotKind: z.string(),
  alternativePivotKinds: z.array(z.string()),
  whyThisPivot: z.string(),
  clarificationQuestion: z.object({ id: z.string(), text: z.string() }).optional()
});

export function createGenkitGooglePivotGenerator(): GooglePivotGenerator {
  const ai = createGoogleGenkit();
  const model = vertexAI.model(process.env.VERTEX_GEMINI_MODEL_ID?.trim() || "gemini-3.5-flash");

  return {
    async generate({ quickDump, situationMap, clarificationAnswers }) {
      const response = await ai.generate({
        model,
        prompt: promptFor({ quickDump, situationMap, clarificationAnswers }),
        output: { schema: pivotOutputSchema }
      });
      if (!response.output) {
        throw new Error("Gemini returned no structured Pivot output.");
      }
      return response.output;
    },
    async adapt({ situationMap, currentDerivedContext, retrievedMemories, guidancePreferences }) {
      const response = await ai.generate({
        model,
        prompt: adaptationPromptFor({ situationMap, currentDerivedContext, retrievedMemories, guidancePreferences }),
        output: { schema: pivotOutputSchema }
      });
      if (!response.output) {
        throw new Error("Gemini returned no adapted Pivot output.");
      }
      return response.output;
    },
    async repair({ quickDump, situationMap, invalidOutput, clarificationAnswers }) {
      const response = await ai.generate({
        model,
        prompt: `${promptFor({ quickDump, situationMap, clarificationAnswers })}\nRepair this invalid candidate and return only the requested structure:\n${JSON.stringify(invalidOutput)}`,
        output: { schema: pivotOutputSchema }
      });
      if (!response.output) {
        throw new Error("Gemini repair returned no structured Pivot output.");
      }
      return response.output;
    },
    async prepareMemory({ situationMap }) {
      const response = await ai.generate({
        model,
        prompt: memoryPreparationPromptFor(situationMap),
        output: { schema: z.string().max(500) }
      });
      if (!response.output) {
        throw new Error("Gemini returned no pending Derived-memory context.");
      }
      return response.output;
    },
    async deriveMemory({ currentContext, selectedPivot, outcome }) {
      const response = await ai.generate({
        model,
        prompt: memoryPromptFor({ currentContext, selectedPivot, outcome }),
        output: { schema: z.string().max(500) }
      });
      if (!response.output) {
        throw new Error("Gemini returned no Derived-memory context.");
      }
      return response.output;
    }
  };
}

export function createGenkitGoogleEmbeddingProvider(): (text: string) => Promise<readonly number[]> {
  const ai = createGoogleGenkit();
  const embedder = vertexAI.embedder(GOOGLE_EMBEDDING_MODEL_ID, {
    outputDimensionality: GOOGLE_EMBEDDING_DIMENSIONS,
    taskType: "RETRIEVAL_DOCUMENT"
  });
  return async (text) => {
    const embeddings = await ai.embed({ embedder, content: text });
    const embedding = embeddings[0]?.embedding;
    if (!embedding) throw new Error("Gemini returned no embedding.");
    return validateGoogleEmbedding(embedding);
  };
}

function createGoogleGenkit() {
  return genkit({
    plugins: [
      vertexAI({
        location: process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1",
        projectId: process.env.FIREBASE_PROJECT_ID?.trim()
      })
    ]
  });
}

function memoryPromptFor(input: {
  currentContext: string;
  selectedPivot: Pivot;
  outcome: PivotOutcome;
}): string {
  return [
    "Create one compact factual Derived-memory context for the person who chose to save this Check-in.",
    "Use plain language, no diagnosis, prediction, emotional score, wellness score, or professional advice.",
    "Keep it under 500 characters. Mention the situation only as needed, the selected Pivot, and the reported outcome.",
    `Current Derived-memory context: ${input.currentContext}`,
    `Selected Pivot: ${input.selectedPivot.title} — ${input.selectedPivot.instruction}`,
    `Reported outcome: ${JSON.stringify(input.outcome)}`
  ].join("\n\n");
}

function memoryPreparationPromptFor(situationMap: SituationMap): string {
  return [
    "Create one compact factual Derived-memory context for the person who chose to save this Check-in.",
    "Use plain language, no diagnosis, prediction, emotional score, wellness score, or professional advice.",
    "Keep it under 500 characters and use only the factual Situation-map context; do not invent details.",
    `Situation map: ${JSON.stringify(situationMap)}`
  ].join("\n\n");
}

function promptFor(input: {
  quickDump: string;
  situationMap: SituationMap;
  clarificationAnswers?: Array<{ questionId: string; answer?: string; skipped: boolean }>;
}): string {
  return [
    "You are the Unstuck Pivot guide for an ordinary, non-clinical stuck situation.",
    "Return only the requested structured output. Do not diagnose, predict crisis, or give professional advice.",
    "Keep person statements in shared and progress with provenance person. Keep interpretations and uncertainties with provenance guide.",
    "Keep artifact-derived claims in artifactClaims with provenance artifact. Never promote artifact or guide claims to person provenance.",
    "Keep contradictions explicit in contradictions until the person resolves them; do not silently choose between conflicting claims.",
    "Use exactly one primary Pivot and exactly two distinct alternatives.",
    "If one useful clarification remains, return one clarificationQuestion; ask no more than two total and never ask more than one at a time.",
    "Pivot kinds must be one of: grounding, breathing-focus, reaching-out, basic-needs-reset, task-first-step.",
    `Quick dump from the person:\n${input.quickDump}`,
    `Initial map to refine:\n${JSON.stringify(input.situationMap)}`,
    `Clarification answers so far:\n${JSON.stringify(input.clarificationAnswers ?? [])}`
  ].join("\n\n");
}

function adaptationPromptFor(input: {
  situationMap: SituationMap;
  currentDerivedContext: string;
  retrievedMemories: readonly { id: string; protocolId: string; context: string; selectedPivotTitle: string; outcome: PivotOutcome }[];
  guidancePreferences: readonly { id: string; text: string }[];
}): string {
  return [
    "Adapt the Unstuck Pivot guide from approved, user-visible context only.",
    "Return only the requested structured output. Do not infer personality, motives, diagnoses, permanent characteristics, or hidden preferences.",
    "Do not mention or reconstruct raw Private entries. Treat each prior memory as a compact factual summary.",
    "Keep person statements and corrections in their existing provenance. Keep prior patterns as guide interpretations.",
    "Use exactly one primary Pivot and exactly two distinct alternatives from: grounding, breathing-focus, reaching-out, basic-needs-reset, task-first-step.",
    `Current approved Derived context: ${input.currentDerivedContext}`,
    `Current Situation map: ${JSON.stringify(input.situationMap)}`,
    `Approved prior Derived memories: ${JSON.stringify(input.retrievedMemories)}`,
    `Explicit Guidance preferences: ${JSON.stringify(input.guidancePreferences)}`
  ].join("\n\n");
}
