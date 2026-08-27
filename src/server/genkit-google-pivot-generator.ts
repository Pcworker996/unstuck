import { genkit, z } from "genkit";
import { vertexAI } from "@genkit-ai/google-genai";

import type {
  GooglePivotGenerator,
  GooglePivotGeneratorOutput,
  SituationMap
} from "../app/google-pivot-protocol";

const mapItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  provenance: z.enum(["person", "guide"])
});

const situationMapSchema = z.object({
  shared: z.array(mapItemSchema),
  interpretations: z.array(mapItemSchema),
  uncertainties: z.array(mapItemSchema),
  constraints: z.array(mapItemSchema),
  progress: z.array(mapItemSchema)
});

const pivotOutputSchema = z.object({
  situationMap: situationMapSchema,
  primaryPivotKind: z.string(),
  alternativePivotKinds: z.array(z.string()),
  whyThisPivot: z.string()
});

export function createGenkitGooglePivotGenerator(): GooglePivotGenerator {
  const ai = genkit({
    plugins: [
      vertexAI({
        location: process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1",
        projectId: process.env.FIREBASE_PROJECT_ID?.trim()
      })
    ]
  });
  const model = vertexAI.model(process.env.VERTEX_GEMINI_MODEL_ID?.trim() || "gemini-3.5-flash");

  return {
    async generate({ quickDump, situationMap }) {
      const response = await ai.generate({
        model,
        prompt: promptFor({ quickDump, situationMap }),
        output: { schema: pivotOutputSchema }
      });
      if (!response.output) {
        throw new Error("Gemini returned no structured Pivot output.");
      }
      return response.output;
    },
    async repair({ quickDump, situationMap, invalidOutput }) {
      const response = await ai.generate({
        model,
        prompt: `${promptFor({ quickDump, situationMap })}\nRepair this invalid candidate and return only the requested structure:\n${JSON.stringify(invalidOutput)}`,
        output: { schema: pivotOutputSchema }
      });
      if (!response.output) {
        throw new Error("Gemini repair returned no structured Pivot output.");
      }
      return response.output;
    }
  };
}

function promptFor(input: { quickDump: string; situationMap: SituationMap }): string {
  return [
    "You are the Unstuck Pivot guide for an ordinary, non-clinical stuck situation.",
    "Return only the requested structured output. Do not diagnose, predict crisis, or give professional advice.",
    "Keep person statements in shared and progress with provenance person. Keep interpretations and uncertainties with provenance guide.",
    "Use exactly one primary Pivot and exactly two distinct alternatives.",
    "Pivot kinds must be one of: grounding, breathing-focus, reaching-out, basic-needs-reset, task-first-step.",
    `Quick dump from the person:\n${input.quickDump}`,
    `Initial map to refine:\n${JSON.stringify(input.situationMap)}`
  ].join("\n\n");
}
