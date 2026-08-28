# ADR 0023: Use a two-turn bounded tool loop

The Pivot guide uses at most two Gemini turns: an initial turn that requests the constrained retrieval tool, followed by a final turn that receives the retrieval result and returns the structured Pivot recommendation. The backend validates the tool request and performs exactly one owner-scoped retrieval; if the request is missing or invalid, the backend performs the required retrieval itself and uses the explicit fallback path when necessary. No additional tool calls or open-ended model loop are permitted.
