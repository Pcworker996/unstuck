# ADR 0046: Run safety before platform work

The application service evaluates the deterministic safety gate before any Gemini call, embedding generation, Firestore write, or memory retrieval. A safety interruption returns immediately through an app-owned response, persists no Check-in memory, and does not enter the agent loop. This makes the highest-priority boundary independent of platform availability and model behavior.
