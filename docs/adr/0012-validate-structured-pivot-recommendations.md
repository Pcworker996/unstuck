# Validate structured Pivot recommendations at the backend seam

Gemini will return Pivot kinds, situational action details, alternatives, a bounded explanation, and an optional clarification in a structured response. The backend will validate those values against the application-owned Pivot library and action limits before constructing the final Pivot protocol, so model output cannot invent action categories or bypass product rules.
