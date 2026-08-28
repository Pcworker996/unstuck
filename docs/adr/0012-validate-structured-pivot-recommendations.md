# Validate structured Pivot recommendations at the backend seam

Gemini will return Pivot kinds, alternatives, a bounded explanation, and an optional retrieved-memory identifier in a structured response. The backend will validate those values against the application-owned Pivot library and construct the final Pivot protocol, so model output cannot invent actions or bypass product rules.
