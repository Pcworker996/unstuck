import { describe, expect, it } from "vitest";

import {
  runGooglePivotProtocol,
  type GooglePivotGenerator
} from "./google-pivot-protocol";
import { PIVOT_LIBRARY } from "./pivot-protocol";

describe("Google Pivot Protocol", () => {
  it("requires consent before normal generation and builds a provenance-aware map", async () => {
    const result = await runGooglePivotProtocol({
      quickDump: "I keep avoiding the moving checklist and do not know where to start.",
      consentGiven: true
    });

    expect(result.kind).toBe("pivot-protocol");
    if (result.kind !== "pivot-protocol") return;

    expect(result.situationMap.shared[0]).toMatchObject({
      text: "I keep avoiding the moving checklist and do not know where to start.",
      provenance: "person"
    });
    expect(result.situationMap.interpretations[0].provenance).toBe("guide");
    expect(result.situationMap.progress[0].provenance).toBe("person");
    expect(result.recommendation.alternatives).toHaveLength(2);
    expect(new Set(result.recommendation.alternatives.map((pivot) => pivot.id)).size).toBe(2);
    expect(result.activity.map((event) => event.kind)).toEqual([
      "safety-completed",
      "consent-verified",
      "map-created",
      "generation",
      "validation"
    ]);
  });

  it("stops before generation for immediate danger", async () => {
    let generated = false;
    const generator: GooglePivotGenerator = {
      async generate() {
        generated = true;
        throw new Error("must not run");
      }
    };

    const result = await runGooglePivotProtocol(
      { quickDump: "I am in immediate danger right now.", consentGiven: true },
      generator
    );

    expect(result.kind).toBe("safety-interruption");
    expect(generated).toBe(false);
    if (result.kind !== "safety-interruption") return;
    expect(result.activity.map((event) => event.kind)).toEqual(["safety-completed", "fallback"]);
  });

  it("returns a typed consent result without calling the generator", async () => {
    let generated = false;
    const generator: GooglePivotGenerator = {
      async generate() {
        generated = true;
        throw new Error("must not run");
      }
    };

    const result = await runGooglePivotProtocol(
      { quickDump: "I am stuck on a normal household task.", consentGiven: false },
      generator
    );

    expect(result).toEqual({ kind: "consent-required" });
    expect(generated).toBe(false);
  });

  it("repairs invalid generation once and keeps recommendations inside the library", async () => {
    let attempts = 0;
    const generator: GooglePivotGenerator = {
      async generate({ situationMap }) {
        attempts += 1;
        return attempts === 1
          ? ({ situationMap, whyThisPivot: "invalid", primaryPivotKind: "invented", alternativePivotKinds: ["invented", "also-invented"] })
          : {
              situationMap,
              primaryPivotKind: PIVOT_LIBRARY[0].kind,
              alternativePivotKinds: [PIVOT_LIBRARY[1].kind, PIVOT_LIBRARY[2].kind],
              whyThisPivot: "A small next step."
            };
      },
      async repair({ situationMap }) {
        attempts += 1;
        return {
          situationMap,
          primaryPivotKind: PIVOT_LIBRARY[0].kind,
          alternativePivotKinds: [PIVOT_LIBRARY[1].kind, PIVOT_LIBRARY[2].kind],
          whyThisPivot: "A small next step."
        };
      }
    };

    const result = await runGooglePivotProtocol(
      { quickDump: "I need to make a difficult decision.", consentGiven: true },
      generator
    );

    expect(result.kind).toBe("pivot-protocol");
    expect(attempts).toBe(2);
  });

  it("falls back while preserving the accepted quick dump after repair failure", async () => {
    const generator: GooglePivotGenerator = {
      async generate({ situationMap }) {
        return { situationMap, whyThisPivot: "invalid", primaryPivotKind: "invented", alternativePivotKinds: [] };
      },
      async repair({ situationMap }) {
        return { situationMap, whyThisPivot: "invalid", primaryPivotKind: "still-invented", alternativePivotKinds: [] };
      }
    };

    const result = await runGooglePivotProtocol(
      { quickDump: "I am overwhelmed by a work task.", consentGiven: true },
      generator
    );

    expect(result.kind).toBe("pivot-protocol");
    if (result.kind !== "pivot-protocol") return;
    expect(result.checkIn.quickDump).toBe("I am overwhelmed by a work task.");
    expect(result.fallback).toBe(true);
    expect(result.activity.at(-1)?.kind).toBe("fallback");
  });
});
